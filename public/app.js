const API = "http://localhost:3000/api";

const servicesBox = document.getElementById("services");
const barberSelect = document.getElementById("barber");
const dateInput = document.getElementById("date");
const slotsBox = document.getElementById("slots");
const slotMessage = document.getElementById("slotMessage");
const resultMessage = document.getElementById("resultMessage");
const createBtn = document.getElementById("createBtn");

const sumService = document.getElementById("sum_service");
const sumBarber = document.getElementById("sum_barber");
const sumDate = document.getElementById("sum_date");
const sumTime = document.getElementById("sum_time");

let selectedService = "";
let selectedServiceName = "";
let selectedTime = "";

dateInput.min = new Date().toISOString().split("T")[0];

async function loadInitialData() {
  try {
    const [servicesRes, barbersRes] = await Promise.all([
      fetch(`${API}/services`),
      fetch(`${API}/barbers`)
    ]);

    const services = await servicesRes.json();
    const barbers = await barbersRes.json();

    servicesBox.innerHTML = "";
    barberSelect.innerHTML = `<option value="">Personel seçin</option>`;

    services.forEach((item) => {
      const card = document.createElement("div");
      card.className = "service-card";
      card.textContent = item.name;

      card.addEventListener("click", () => {
        document.querySelectorAll(".service-card").forEach((el) => {
          el.classList.remove("active");
        });

        card.classList.add("active");
        selectedService = String(item.id);
        selectedServiceName = item.name;
        updateSummary();
        loadSlots();
      });

      servicesBox.appendChild(card);
    });

    barbers.forEach((item) => {
      barberSelect.innerHTML += `<option value="${item.id}">${item.name}</option>`;
    });

    updateSummary();
  } catch (error) {
    resetSlots("Veriler yüklenemedi.");
  }
}

function updateSummary() {
  const barberText =
    barberSelect.selectedIndex > 0
      ? barberSelect.options[barberSelect.selectedIndex].text
      : "-";

  sumService.textContent = selectedServiceName || "-";
  sumBarber.textContent = barberText;
  sumDate.textContent = dateInput.value || "-";
  sumTime.textContent = selectedTime ? selectedTime.slice(0, 5) : "-";
}

function resetSlots(message = "Tarih, hizmet ve personel seçiniz.") {
  selectedTime = "";
  slotsBox.innerHTML = "";
  sumTime.textContent = "-";
  slotMessage.style.display = "block";
  slotMessage.textContent = message;
}

async function loadSlots() {
  const serviceId = selectedService;
  const barberId = barberSelect.value;
  const date = dateInput.value;

  updateSummary();

  if (!serviceId || !barberId || !date) {
    resetSlots("Tarih, hizmet ve personel seçiniz.");
    return;
  }

  try {
    const res = await fetch(
      `${API}/available-slots?date=${date}&service_id=${serviceId}&barber_id=${barberId}`
    );

    const data = await res.json();

    slotsBox.innerHTML = "";
    selectedTime = "";
    sumTime.textContent = "-";

    const allSlots = Array.isArray(data.allSlots) ? data.allSlots : [];
    const takenSlots = Array.isArray(data.taken) ? data.taken : [];
    const availableSlots = Array.isArray(data.available) ? data.available : [];

    if (allSlots.length === 0) {
      slotMessage.style.display = "block";
      slotMessage.textContent = "Bu seçim için uygun saat bulunamadı.";
      return;
    }

    slotMessage.style.display = "none";

    allSlots.forEach((time) => {
      const isTaken = takenSlots.includes(time);
      const isAvailable = availableSlots.includes(time);

      const wrapper = document.createElement("div");
      wrapper.className = "slot-item";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "slot-btn";
      btn.textContent = time.slice(0, 5);

      const status = document.createElement("div");
      status.className = "slot-status";

      if (isTaken || !isAvailable) {
        btn.classList.add("taken");
        btn.disabled = true;
        status.textContent = "dolu";
      } else {
        btn.addEventListener("click", () => {
          document.querySelectorAll(".slot-btn").forEach((item) => {
            item.classList.remove("active");
          });

          btn.classList.add("active");
          selectedTime = time;
          updateSummary();
        });
      }

      wrapper.appendChild(btn);
      wrapper.appendChild(status);
      slotsBox.appendChild(wrapper);
    });
  } catch (error) {
    resetSlots("Saatler alınamadı.");
  }
}

async function createAppointment() {
  const payload = {
    full_name: document.getElementById("name").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    service_id: selectedService,
    barber_id: barberSelect.value,
    appointment_date: dateInput.value,
    appointment_time: selectedTime
  };

  resultMessage.className = "result-message";
  resultMessage.textContent = "";

  if (
    !payload.full_name ||
    !payload.phone ||
    !payload.service_id ||
    !payload.barber_id ||
    !payload.appointment_date ||
    !payload.appointment_time
  ) {
    resultMessage.classList.add("error");
    resultMessage.textContent = "Lütfen tüm alanları doldurun.";
    return;
  }

  try {
    const res = await fetch(`${API}/appointments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      resultMessage.classList.add("error");
      resultMessage.textContent = data.message || "Randevu oluşturulamadı.";
      return;
    }

    resultMessage.classList.add("success");
    resultMessage.textContent = "Randevu başarıyla oluşturuldu.";

    document.getElementById("name").value = "";
    document.getElementById("phone").value = "";
    selectedTime = "";
    updateSummary();
    await loadSlots();
  } catch (error) {
    resultMessage.classList.add("error");
    resultMessage.textContent = "Sunucu bağlantı hatası.";
  }
}

barberSelect.addEventListener("change", () => {
  updateSummary();
  loadSlots();
});

dateInput.addEventListener("change", loadSlots);
createBtn.addEventListener("click", createAppointment);

loadInitialData();
resetSlots();