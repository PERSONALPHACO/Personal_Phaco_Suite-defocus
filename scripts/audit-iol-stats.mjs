import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log("=== IOL Stats via adminGetIOLStats query ===");
const [iolStats] = await conn.execute(`
  SELECT 
    i.id as iolId,
    i.model as iolModel,
    i.type as iolType,
    m.name as manufacturerName,
    COUNT(DISTINCT pi.id) as totalUses,
    COUNT(DISTINCT ms.id) as totalMeasurements,
    COUNT(DISTINCT p.userId) as totalDoctors
  FROM iols i
  LEFT JOIN patient_iols pi ON pi.iolId = i.id
  LEFT JOIN patients p ON pi.patientId = p.id
  LEFT JOIN measurements ms ON ms.patientIolId = pi.id
  LEFT JOIN manufacturers m ON i.manufacturerId = m.id
  WHERE i.isActive = 1
  GROUP BY i.id, i.model, i.type, m.name
  ORDER BY COUNT(DISTINCT pi.id) DESC
  LIMIT 10
`);
console.table(iolStats);

console.log("\n=== adminGetIOLCurve for Galaxy (check iolId) ===");
// Find Galaxy IOL id
const [galaxyRows] = await conn.execute(`SELECT id, model FROM iols WHERE model LIKE '%Galaxy%' LIMIT 3`);
console.log("Galaxy IOLs:", galaxyRows);

if (galaxyRows.length > 0) {
  const galaxyId = galaxyRows[0].id;
  const [curveRows] = await conn.execute(`
    SELECT 
      mp.diopter,
      mp.visualAcuity,
      mp.measurementId,
      ms.userId
    FROM measurement_points mp
    INNER JOIN measurements ms ON mp.measurementId = ms.id
    INNER JOIN patient_iols pi ON ms.patientIolId = pi.id
    WHERE pi.iolId = ?
    ORDER BY mp.diopter ASC
    LIMIT 30
  `, [galaxyId]);
  console.log(`\nGalaxy (id=${galaxyId}) curve points (first 30):`, curveRows.length, "points");
  if (curveRows.length > 0) console.table(curveRows.slice(0, 10));
}

console.log("\n=== Check measurement_points table structure ===");
const [cols] = await conn.execute(`DESCRIBE measurement_points`);
console.table(cols);

console.log("\n=== Sample measurement_points data ===");
const [samplePoints] = await conn.execute(`SELECT * FROM measurement_points LIMIT 10`);
console.table(samplePoints);

console.log("\n=== Check measurements → patient_iols join ===");
const [joinCheck] = await conn.execute(`
  SELECT ms.id as msId, ms.patientIolId, pi.iolId, pi.patientId
  FROM measurements ms
  INNER JOIN patient_iols pi ON ms.patientIolId = pi.id
  LIMIT 10
`);
console.table(joinCheck);

await conn.end();
