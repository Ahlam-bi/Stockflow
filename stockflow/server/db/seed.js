import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';

const cx = await pool.connect();
try {
  await cx.query('BEGIN');
  await cx.query('TRUNCATE stock_movements,order_items,orders,products,clients,categories,users RESTART IDENTITY CASCADE');
  const passwordHash = await bcrypt.hash('Stockflow123!', 10);
  const users=[];
  for (const [name,email,role] of [['Admin StockFlow','admin@stockflow.local','admin'],['Amine Staff','amine@stockflow.local','staff'],['Sara Staff','sara@stockflow.local','staff']]) {
    users.push((await cx.query('INSERT INTO users(full_name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id',[name,email,passwordHash,role])).rows[0].id);
  }
  const categoryNames=['Informatique','Périphériques','Mobilier','Papeterie','Réseau'];
  const categoryIds=[];
  for(const name of categoryNames) categoryIds.push((await cx.query('INSERT INTO categories(name) VALUES($1) RETURNING id',[name])).rows[0].id);
  const productIds=[];
  const catalog=[['Ordinateur portable','IT-001',6800,0],['Écran 24 pouces','IT-002',1750,0],['Clavier mécanique','PR-001',420,1],['Souris sans fil','PR-002',180,1],['Casque USB','PR-003',320,1],['Bureau compact','MO-001',1450,2],['Chaise ergonomique','MO-002',2300,2],['Carnet A4','PA-001',35,3],['Ramette papier','PA-002',65,3],['Stylo bleu (lot)','PA-003',24,3],['Routeur Wi-Fi','RE-001',890,4],['Switch 8 ports','RE-002',620,4],['Webcam HD','PR-004',390,1],['Disque SSD 1 To','IT-003',990,0],['Support ordinateur','PR-005',210,1]];
  for(const [name,sku,price,cat] of catalog) productIds.push((await cx.query('INSERT INTO products(name,sku,price,category_id) VALUES($1,$2,$3,$4) RETURNING id',[name,sku,price,categoryIds[cat]])).rows[0].id);
  const clientIds=[];
  for(const [name,phone,email] of [['Atlas Conseil','0600000101','contact@atlas.ma'],['Nova Design','0600000102','hello@nova.ma'],['Bureau Horizon','0600000103',null],['Pixel Studio','0600000104','achats@pixel.ma'],['Médina Services','0600000105',null]]) clientIds.push((await cx.query('INSERT INTO clients(full_name,phone,email) VALUES($1,$2,$3) RETURNING id',[name,phone,email])).rows[0].id);
  for(const productId of productIds){await cx.query('UPDATE products SET stock_quantity=30 WHERE id=$1',[productId]);await cx.query("INSERT INTO stock_movements(type,product_id,quantity,reason,created_by) VALUES('IN',$1,30,'Stock initial', $2)",[productId,users[0]]);}
  const statuses=['draft','confirmed','delivered','cancelled','confirmed','draft','delivered','confirmed','cancelled','draft'];
  for(let i=0;i<10;i++){
    const order=(await cx.query('INSERT INTO orders(client_id,status,created_by) VALUES($1,\'draft\',$2) RETURNING id',[clientIds[i%clientIds.length],users[i%users.length]])).rows[0];
    const lines=1+(i%2);let total=0;
    for(let j=0;j<lines;j++){
      const idx=(i*2+j)%productIds.length, qty=1+(i%3), product=(await cx.query('SELECT id,price FROM products WHERE id=$1',[productIds[idx]])).rows[0];
      const subtotal=Number(product.price)*qty;total+=subtotal;
      await cx.query('INSERT INTO order_items(order_id,product_id,quantity,unit_price,subtotal) VALUES($1,$2,$3,$4,$5)',[order.id,product.id,qty,product.price,subtotal]);
      if(['confirmed','delivered'].includes(statuses[i])){
        await cx.query('UPDATE products SET stock_quantity=stock_quantity-$1 WHERE id=$2',[qty,product.id]);
        await cx.query("INSERT INTO stock_movements(type,product_id,quantity,reason,created_by) VALUES('OUT',$1,$2,$3,$4)",[product.id,qty,`Commande #${order.id}`,users[0]]);
      }
    }
    await cx.query('UPDATE orders SET status=$1,total_amount=$2 WHERE id=$3',[statuses[i],total,order.id]);
  }
  await cx.query('COMMIT');
  console.log('Seed terminé : 3 utilisateurs, 5 catégories, 15 produits, 5 clients, 10 commandes et mouvements de stock.');
  console.log('Comptes de démonstration : admin@stockflow.local / Stockflow123! ; amine@stockflow.local / Stockflow123! ; sara@stockflow.local / Stockflow123!');
} catch(error){await cx.query('ROLLBACK');console.error(error);process.exitCode=1;} finally{cx.release();await pool.end();}
