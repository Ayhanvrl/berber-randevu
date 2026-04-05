const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "barber_app"
});

db.connect(err => {
  if (err) return console.log(err);
  console.log("MySQL bağlandı");
});

// ÇALIŞMA SAATİ
const WORK_START = 10;
const WORK_END = 20;

// SLOT ÜRET
function generateSlots() {
  const slots = [];
  for (let h = WORK_START; h < WORK_END; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00:00`);
    slots.push(`${String(h).padStart(2, "0")}:30:00`);
  }
  return slots;
}

//////////////////////////////////////////////////////
// 🔹 HİZMETLER
//////////////////////////////////////////////////////
app.get("/api/services", (req, res) => {
  db.query("SELECT * FROM services WHERE is_active=1", (err, result) => {
    if (err) return res.status(500).json({ message: "Hizmet alınamadı" });
    res.json(result);
  });
});

//////////////////////////////////////////////////////
// 🔹 BERBERLER
//////////////////////////////////////////////////////
app.get("/api/barbers", (req, res) => {
  db.query("SELECT * FROM barbers WHERE is_active=1", (err, result) => {
    if (err) return res.status(500).json({ message: "Berber alınamadı" });
    res.json(result);
  });
});

//////////////////////////////////////////////////////
// 🔹 MÜSAİT SAATLER
//////////////////////////////////////////////////////
app.get("/api/available-slots", (req, res) => {
  const { date, barber_id, service_id } = req.query;

  if (!date || !barber_id || !service_id) {
    return res.status(400).json({ message: "Eksik parametre" });
  }

  // hizmet süresi al
  db.query(
    "SELECT duration FROM services WHERE id=?",
    [service_id],
    (err, serviceRes) => {
      if (err || serviceRes.length === 0) {
        return res.status(500).json({ message: "Hizmet bulunamadı" });
      }

      const duration = serviceRes[0].duration;
      const allSlots = generateSlots();

      db.query(
        `SELECT appointment_time, service_id 
         FROM appointments 
         WHERE appointment_date=? AND barber_id=? AND status!='iptal'`,
        [date, barber_id],
        (err, appointments) => {
          if (err) {
            return res.status(500).json({ message: "Saatler alınamadı" });
          }

          const taken = [];

          appointments.forEach(app => {
            taken.push(app.appointment_time);
          });

          // basit çakışma kontrol (şimdilik)
          const available = allSlots.filter(s => !taken.includes(s));

          res.json({
            allSlots,
            taken,
            available
          });
        }
      );
    }
  );
});

//////////////////////////////////////////////////////
// 🔹 RANDEVU OLUŞTUR
//////////////////////////////////////////////////////
app.post("/api/appointments", (req, res) => {
  const {
    full_name,
    phone,
    service_id,
    barber_id,
    appointment_date,
    appointment_time
  } = req.body;

  if (!full_name || !phone || !service_id || !barber_id || !appointment_date || !appointment_time) {
    return res.status(400).json({ message: "Eksik alan" });
  }

  db.query(
    `SELECT * FROM appointments 
     WHERE appointment_date=? AND appointment_time=? AND barber_id=? AND status!='iptal'`,
    [appointment_date, appointment_time, barber_id],
    (err, result) => {
      if (result.length > 0) {
        return res.status(409).json({ message: "Bu saat dolu" });
      }

      db.query(
        `INSERT INTO appointments 
        (full_name, phone, service_id, barber_id, appointment_date, appointment_time)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [full_name, phone, service_id, barber_id, appointment_date, appointment_time],
        (err) => {
          if (err) return res.status(500).json({ message: "Kaydedilemedi" });

          res.json({ message: "Randevu oluşturuldu" });
        }
      );
    }
  );
});

//////////////////////////////////////////////////////
// 🔹 ADMİN
//////////////////////////////////////////////////////
app.get("/api/appointments", (req, res) => {
  const sql = `
    SELECT a.*, s.name as service_name, b.name as barber_name
    FROM appointments a
    JOIN services s ON a.service_id = s.id
    JOIN barbers b ON a.barber_id = b.id
    ORDER BY appointment_date, appointment_time
  `;

  db.query(sql, (err, result) => {
    if (err) return res.status(500).json({ message: "Hata" });
    res.json(result);
  });
});

app.patch("/api/appointments/:id", (req, res) => {
  const { status } = req.body;

  db.query(
    "UPDATE appointments SET status=? WHERE id=?",
    [status, req.params.id],
    () => res.json({ message: "Güncellendi" })
  );
});

app.listen(PORT, () => {
  console.log("Server çalışıyor: http://localhost:3000");
});