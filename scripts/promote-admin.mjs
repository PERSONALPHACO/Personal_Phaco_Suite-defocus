import mysql from 'mysql2/promise';

const dbUrl = process.env.DATABASE_URL;
const connection = await mysql.createConnection(dbUrl);

// Listar todos os usuários
const [rows] = await connection.execute("SELECT id, name, email, role FROM users ORDER BY name");
console.log("Todos os usuários:");
console.log(JSON.stringify(rows, null, 2));

// Promover Renato a admin
const [result] = await connection.execute(
  "UPDATE users SET role = 'admin' WHERE LOWER(email) LIKE '%renatooftalmo%' OR LOWER(name) LIKE '%renato%'"
);
console.log("\nLinhas atualizadas:", result.affectedRows);

// Confirmar admins
const [admins] = await connection.execute("SELECT id, name, email, role FROM users WHERE role = 'admin'");
console.log("\nAdmins após atualização:");
console.log(JSON.stringify(admins, null, 2));

await connection.end();
