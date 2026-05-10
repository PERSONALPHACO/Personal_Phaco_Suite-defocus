import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// 1. IOL Stats query
const [iolStats] = await conn.execute(`
  SELECT 
    i.id as iolId, i.model, i.type,
    COUNT(DISTINCT pi.id) as totalUses,
    COUNT(DISTINCT ms.id) as totalMeasurements,
    COUNT(DISTINCT p.userId) as totalDoctors
  FROM iols i
  LEFT JOIN patient_iols pi ON pi.iolId = i.id
  LEFT JOIN patients p ON pi.patientId = p.id
  LEFT JOIN measurements ms ON ms.patientIolId = pi.id
  WHERE i.isActive = 1
  GROUP BY i.id, i.model, i.type
  ORDER BY totalUses DESC
  LIMIT 10
`);
console.log("=== IOL Stats (top 10 by uses) ===");
for (const r of iolStats) {
  console.log(`  id=${r.iolId} model="${r.model}" uses=${r.totalUses} measurements=${r.totalMeasurements} doctors=${r.totalDoctors}`);
}

// 2. adminGetIOLCurve - check Galaxy specifically
const [galaxyRows] = await conn.execute(`SELECT id, model FROM iols WHERE model LIKE '%Galaxy%' LIMIT 3`);
console.log("\n=== Galaxy IOL IDs ===");
for (const g of galaxyRows) console.log(`  id=${g.id} model="${g.model}"`);

if (galaxyRows.length > 0) {
  const gId = galaxyRows[0].id;
  const [caseCount] = await conn.execute(`
    SELECT COUNT(DISTINCT ms.id) as cases, COUNT(DISTINCT ms.userId) as doctors
    FROM measurements ms
    INNER JOIN patient_iols pi ON ms.patientIolId = pi.id
    WHERE pi.iolId = ?
  `, [gId]);
  console.log(`\nGalaxy (id=${gId}) via iolCurve query: cases=${caseCount[0].cases} doctors=${caseCount[0].doctors}`);
  
  // Check if measurements.userId exists
  const [msFields] = await conn.execute(`DESCRIBE measurements`);
  console.log("\n=== measurements table fields ===");
  for (const f of msFields) console.log(`  ${f.Field} ${f.Type} ${f.Null}`);
}

// 3. Check if measurements has userId field
const [msCheck] = await conn.execute(`
  SELECT ms.id, ms.patientIolId, ms.userId, pi.iolId
  FROM measurements ms
  INNER JOIN patient_iols pi ON ms.patientIolId = pi.id
  LIMIT 5
`);
console.log("\n=== Sample measurements with userId ===");
for (const r of msCheck) console.log(`  msId=${r.id} patientIolId=${r.patientIolId} userId=${r.userId} iolId=${r.iolId}`);

// 4. Check patients.userId vs measurements.userId
const [patCheck] = await conn.execute(`DESCRIBE patients`);
console.log("\n=== patients table fields ===");
for (const f of patCheck) console.log(`  ${f.Field} ${f.Type}`);

await conn.end();
