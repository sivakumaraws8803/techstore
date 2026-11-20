import "dotenv/config";
import express from "express";
import helmet from "helmet";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "techstore",
  user: process.env.DB_USER || "techstore_app",
  password: process.env.DB_PASSWORD,
  max: 5,
  connectionTimeoutMillis: 5000
});
pool.on("error", error => console.error("[order-service] database pool:", error.message));

const app = express();
const PORT = Number(process.env.PORT || 3004);
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error("SESSION_SECRET must match auth-service during the session migration");
}
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet());
app.use(express.json({limit:"50kb"}));
const PgSession = connectPgSimple(session);
app.use(session({
  name:"techstore.sid",
  store:new PgSession({pool,tableName:"user_sessions",createTableIfMissing:false}),
  secret:process.env.SESSION_SECRET,resave:false,saveUninitialized:false,
  cookie:{httpOnly:true,secure:process.env.COOKIE_SECURE==="true",sameSite:"lax",maxAge:8*60*60*1000}
}));
const auth=(req,res,next)=>req.session?.user?.id ? next() : res.status(401).json({error:"Authentication required"});
const role=(...roles)=>(req,res,next)=>!req.session?.user ? res.status(401).json({error:"Authentication required"}) : roles.includes(req.session.user.role) ? next() : res.status(403).json({error:"Permission denied"});
const id=value=>/^\\d{1,18}$/.test(String(value||"")) && Number(value)>0;
const fail=(status,message)=>Object.assign(new Error(message),{status});

app.get("/health",async(_req,res)=>{try{await pool.query("SELECT 1");res.json({status:"ok",service:"order-service",database:"connected"});}catch{res.status(503).json({status:"error",service:"order-service",database:"unavailable"});}});
app.get("/api/v1",(_req,res)=>res.json({service:"order-service",endpoints:["POST /api/orders","GET /api/orders/my","GET /api/orders","PATCH /api/orders/:id/status"]}));

async function readOrders(where,params){
 const result=await pool.query(`SELECT o.id,o.customer_id,o.status,o.payment_status,o.total_amount,o.created_at,oi.product_id,oi.product_name,oi.quantity,oi.unit_price,oi.variant_id,oi.variant_sku,oi.variant_name,oi.variant_attributes
 FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id ${where} ORDER BY o.created_at DESC,oi.id`,params);
 const map=new Map();
 for(const row of result.rows){
  if(!map.has(row.id))map.set(row.id,{id:row.id,customer_id:row.customer_id,status:row.status,payment_status:row.payment_status||"pending",total_amount:row.total_amount,created_at:row.created_at,items:[]});
  if(row.product_id!==null)map.get(row.id).items.push({product_id:row.product_id,product_name:row.product_name,quantity:row.quantity,unit_price:row.unit_price,variant_id:row.variant_id,variant_sku:row.variant_sku,variant_name:row.variant_name,variant_attributes:row.variant_attributes||{}});
 }
 return [...map.values()];
}
app.post("/api/orders",auth,role("customer"),async(req,res,next)=>{
 const items=req.body?.items;
 if(!Array.isArray(items)||items.length===0||items.length>50)return res.status(400).json({error:"Provide between 1 and 50 order items"});
 const normalized=[];
 for(const item of items){
  const quantity=Number(item?.quantity);
  const variantId=item?.variantId==null?null:Number(item.variantId);
  const productId=item?.productId==null?null:Number(item.productId);
  if(!Number.isSafeInteger(quantity)||quantity<1||quantity>1000)return res.status(400).json({error:"Invalid item quantity"});
  if(variantId!==null&&(!Number.isSafeInteger(variantId)||variantId<1))return res.status(400).json({error:"Invalid variant ID"});
  if(variantId===null&&(!Number.isSafeInteger(productId)||productId<1))return res.status(400).json({error:"Invalid product ID"});
  normalized.push({variantId,productId,quantity});
 }
 const client=await pool.connect();
 try{
  await client.query("BEGIN");
  const locked=[];
  for(const item of normalized){
   let row;
   if(item.variantId!==null){
    const result=await client.query(
     `SELECT v.id AS variant_id,v.product_id,v.sku,v.name AS variant_name,v.attributes,v.price,v.stock,v.image_url,
             p.name AS product_name,p.is_active
      FROM product_variants v JOIN products p ON p.id=v.product_id
      WHERE v.id=$1 AND v.is_active=TRUE FOR UPDATE OF v,p`,[item.variantId]);
    row=result.rows[0];
   } else {
    const result=await client.query(
     `SELECT NULL::bigint AS variant_id,p.id AS product_id,NULL::text AS sku,NULL::text AS variant_name,
             '{}'::jsonb AS attributes,p.price,p.stock,p.image_url,p.name AS product_name,p.is_active
      FROM products p WHERE p.id=$1 FOR UPDATE`,[item.productId]);
    row=result.rows[0];
   }
   if(!row)throw fail(404,"Product or selected variant is unavailable");
   if(!row.is_active)throw fail(409,row.product_name+" is unavailable");
   if(Number(row.stock)<item.quantity)throw fail(409,"Insufficient stock for "+row.product_name+(row.variant_name?" ("+row.variant_name+")":""));
   locked.push({...row,quantity:item.quantity});
  }
  const duplicateKeys=new Set();
  for(const item of locked){const key=item.variant_id!==null?"v:"+item.variant_id:"p:"+item.product_id;if(duplicateKeys.has(key))throw fail(400,"Duplicate cart items must be combined before checkout");duplicateKeys.add(key);}
  let cents=0n;
  for(const item of locked)cents+=BigInt(Math.round(Number(item.price)*100))*BigInt(item.quantity);
  const amount=(cents/100n).toString()+"."+(cents%100n).toString().padStart(2,"0");
  const order=(await client.query("INSERT INTO orders(customer_id,status,total_amount) VALUES($1,'pending',$2) RETURNING id,customer_id,status,total_amount,created_at",[req.session.user.id,amount])).rows[0];
  for(const item of locked){
   await client.query(
    `INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price,variant_id,variant_sku,variant_name,variant_attributes)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
    [order.id,item.product_id,item.product_name,item.quantity,item.price,item.variant_id,item.sku,item.variant_name,JSON.stringify(item.attributes||{})]);
   if(item.variant_id!==null){
    await client.query("UPDATE product_variants SET stock=stock-$1,updated_at=NOW() WHERE id=$2",[item.quantity,item.variant_id]);
    await client.query("UPDATE products SET stock=(SELECT COALESCE(SUM(stock),0) FROM product_variants WHERE product_id=$1 AND is_active=TRUE),updated_at=NOW() WHERE id=$1",[item.product_id]);
   } else {
    await client.query("UPDATE products SET stock=stock-$1,updated_at=NOW() WHERE id=$2",[item.quantity,item.product_id]);
   }
  }
  await client.query("COMMIT");
  res.status(201).json({message:"Order created successfully",order:{...order,items:locked.map(item=>({product_id:item.product_id,product_name:item.product_name,quantity:item.quantity,unit_price:item.price,variant_id:item.variant_id,variant_sku:item.sku,variant_name:item.variant_name,variant_attributes:item.attributes||{}}))}});
 }catch(error){await client.query("ROLLBACK");next(error);}finally{client.release();}
});
app.get("/api/orders/my",auth,role("customer"),async(req,res,next)=>{try{res.json({orders:await readOrders("WHERE o.customer_id=$1",[req.session.user.id])});}catch(e){next(e);}});
app.get("/api/orders",auth,role("owner","product_manager"),async(_req,res,next)=>{try{res.json({orders:await readOrders("",[])});}catch(e){next(e);}});
app.patch("/api/orders/:id/status",auth,role("owner","product_manager"),async(req,res,next)=>{
 const orderId=Number(req.params.id),status=req.body?.status;
 if(!Number.isSafeInteger(orderId)||orderId<1)return res.status(400).json({error:"Invalid order ID"});
 if(!["pending","confirmed","shipped","delivered","cancelled"].includes(status))return res.status(400).json({error:"Invalid order status"});
 try{const result=await pool.query("UPDATE orders SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING id,status,total_amount,created_at",[status,orderId]);if(!result.rowCount)return res.status(404).json({error:"Order not found"});res.json({message:"Order status updated",order:result.rows[0]});}catch(e){next(e);}
});
app.use((req,res)=>res.status(404).json({error:"NOT_FOUND",path:req.originalUrl}));
app.use((error,_req,res,_next)=>{console.error("[order-service]",error.message);if(!res.headersSent)res.status(error.status||500).json({error:error.status?error.message:"Internal server error"});});
const server=app.listen(PORT,"127.0.0.1",()=>console.log("[order-service] listening on 127.0.0.1:"+PORT));
async function shutdown(signal){console.log("[order-service] "+signal+" received");server.close(async()=>{await pool.end();process.exit(0);});}
process.on("SIGTERM",()=>shutdown("SIGTERM"));process.on("SIGINT",()=>shutdown("SIGINT"));
