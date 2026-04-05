const API = "http://localhost:3000/api";
const appointmentList = document.getElementById("appointmentList");
const refreshBtn = document.getElementById("refreshBtn");

function formatDate(dateStr) {
  if (!dateStr) return "-";
  return dateStr.split("T")[0];
}

function formatTime(timeStr) {
  if (!timeStr) return "-";
  return String(timeStr).slice(0, 5);
}

function getStatusClass(status) {
  if (status === "onaylandi") return "status-onaylandi";
  if (status === "iptal") return "status-iptal";
  return "status-beklemede";
}

async function loadAppointments() {
  appointmentList.innerHTML = `<div class="empty-box">Yükleniyor...</div>`;

  try {
    const res = await fetch(`${API}/appointments`);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      appointmentList.innerHTML = `<div class="empty-box">Henüz randevu yok.</div>`;
      return;
    }

    appointmentList.innerHTML = "";

    data.forEach((item) => {
      const card = document.createElement("div");
      card.className = "appointment-card";

      card.innerHTML = `
        <div class="appointment-top">
          <div class="appointment-name">${item.full_name}</div>
          <div class="status-badge ${getStatusClass(item.status)}">${item.status}</div>
        </div>

        <div class="info-grid">
          <div class="info-box">
            <span>Telefon</span>
            <strong>${item.phone}</strong>
          </div>
          <div class="info-box">
            <span>Hizmet</span>
            <strong>${item.service_name || "-"}</strong>
          </div>
          <div class="info-box">
            <span>Personel</span>
            <strong>${item.barber_name || "-"}</strong>
          </div>
          <div class="info-box">
            <span>Tarih</span>
            <strong>${formatDate(item.appointment_date)}</strong>
          </div>
          <div class="info-box">
            <span>Saat</span>
            <strong>${formatTime(item.appointment_time)}</strong>
          </div>
          <div class="info-box">
            <span>Oluşturulma</span>
            <strong>${formatDate(item.created_at)}</strong>
          </div>
        </div>

        <div class="actions">
          <button class="btn-waiting" data-id="${item.id}" data-status="beklemede">Beklemeye Al</button>
          <button class="btn-cancel" data-id="${item.id}" data-status="iptal">İptal Et</button>
          <button class="btn-delete" data-id="${item.id}" data-delete="true">Sil</button>
        </div>
      `;

      appointmentList.appendChild(card);
    });

    bindActions();
  } catch (error) {
    appointmentList.innerHTML = `<div class="empty-box">Randevular yüklenemedi.</div>`;
  }
}

function bindActions() {
  document.querySelectorAll("[data-status]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const status = btn.dataset.status;

      try {
        const res = await fetch(`${API}/appointments/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ status })
        });

        const data = await res.json();

        if (!res.ok) {
          alert(data.message || "Durum güncellenemedi.");
          return;
        }

        loadAppointments();
      } catch (error) {
        alert("Sunucu hatası.");
      }
    });
  });

  document.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const ok = confirm("Bu randevu silinsin mi?");
      if (!ok) return;

      try {
        const res = await fetch(`${API}/appointments/${id}`, {
          method: "DELETE"
        });

        const data = await res.json();

        if (!res.ok) {
          alert(data.message || "Silinemedi.");
          return;
        }

        loadAppointments();
      } catch (error) {
        alert("Sunucu hatası.");
      }
    });
  });
}

refreshBtn.addEventListener("click", loadAppointments);

loadAppointments();