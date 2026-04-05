const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server çalışıyor:", PORT);
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const db = mysql.createPool({
  host: process.env.MYSQLHOST,
  port: Number(process.env.MYSQLPORT || 3306),
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

db.getConnection((err, connection) => {
  if (err) {
    console.error("MySQL bağlantı hatası:", err.message);
  } else {
    console.log("MySQL bağlandı");
    connection.release();
  }
});

const WORK_START = 10;
const WORK_END = 20;

function generateSlots() {
  const slots = [];
  for (let hour = WORK_START; hour < WORK_END; hour++) {
    slots.push(`${String(hour).padStart(2, "0")}:00:00`);
    slots.push(`${String(hour).padStart(2, "0")}:30:00`);
  }
  return slots;
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    message: "Server çalışıyor",
    env: {
      hasHost: !!process.env.MYSQLHOST,
      hasUser: !!process.env.MYSQLUSER,
      hasPassword: !!process.env.MYSQLPASSWORD,
      hasDatabase: !!process.env.MYSQLDATABASE,
      port: PORT
    }
  });
});

app.get("/api/services", (req, res) => {
  db.query(
    "SELECT id, name, duration, price FROM services WHERE is_active = 1 ORDER BY id ASC",
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Hizmetler alınamadı", error: err.message });
      }
      res.json(result);
    }
  );
});

app.get("/api/barbers", (req, res) => {
  db.query(
    "SELECT id, name FROM barbers WHERE is_active = 1 ORDER BY id ASC",
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Personeller alınamadı", error: err.message });
      }
      res.json(result);
    }
  );
});

app.get("/api/available-slots", (req, res) => {
  const { date, barber_id, service_id } = req.query;

  if (!date || !barber_id || !service_id) {
    return res.status(400).json({ message: "Eksik parametre" });
  }

  const allSlots = generateSlots();

  db.query(
    `SELECT appointment_time
     FROM appointments
     WHERE appointment_date = ?
       AND barber_id = ?
       AND status != 'iptal'`,
    [date, barber_id],
    (err, appointments) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Saatler alınamadı", error: err.message });
      }

      const taken = appointments.map((item) => String(item.appointment_time).slice(0, 8));
      const available = allSlots.filter((slot) => !taken.includes(slot));

      res.json({ allSlots, taken, available });
    }
  );
});

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
    return res.status(400).json({ message: "Eksik alan var" });
  }

  db.query(
    `SELECT id FROM appointments
     WHERE appointment_date = ?
       AND appointment_time = ?
       AND barber_id = ?
       AND status != 'iptal'`,
    [appointment_date, appointment_time, barber_id],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Kontrol sırasında hata oluştu", error: err.message });
      }

      if (result.length > 0) {
        return res.status(409).json({ message: "Bu saat dolu" });
      }

      db.query(
        `INSERT INTO appointments
        (full_name, phone, service_id, barber_id, appointment_date, appointment_time, status)
        VALUES (?, ?, ?, ?, ?, ?, 'beklemede')`,
        [full_name, phone, service_id, barber_id, appointment_date, appointment_time],
        (err2, insertResult) => {
          if (err2) {
            console.error(err2);
            return res.status(500).json({ message: "Randevu oluşturulamadı", error: err2.message });
          }

          res.status(201).json({
            message: "Randevu başarıyla oluşturuldu",
            id: insertResult.insertId
          });
        }
      );
    }
  );
});

app.get("/api/appointments", (req, res) => {
  const sql = `
    SELECT
      a.id,
      a.full_name,
      a.phone,
      a.appointment_date,
      a.appointment_time,
      a.status,
      a.created_at,
      s.name AS service_name,
      b.name AS barber_name
    FROM appointments a
    JOIN services s ON a.service_id = s.id
    JOIN barbers b ON a.barber_id = b.id
    ORDER BY a.appointment_date ASC, a.appointment_time ASC
  `;

  db.query(sql, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Randevular alınamadı", error: err.message });
    }
    res.json(result);
  });
});

app.patch("/api/appointments/:id", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!["beklemede", "iptal"].includes(status)) {
    return res.status(400).json({ message: "Geçersiz durum" });
  }

  db.query(
    "UPDATE appointments SET status = ? WHERE id = ?",
    [status, id],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Durum güncellenemedi", error: err.message });
      }
      res.json({ message: "Durum güncellendi" });
    }
  );
});

app.delete("/api/appointments/:id", (req, res) => {
  const { id } = req.params;

  db.query("DELETE FROM appointments WHERE id = ?", [id], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Silinemedi", error: err.message });
    }
    res.json({ message: "Silindi" });
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/admin.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server çalışıyor: ${PORT}`);
});