const USERNAME_HASH = "3046f751cdc6f2ebb9dac47dea910d8ec6bbb8060b3b17399aad9ac96eac8dd1";
const PASSWORD_HASH = "78f463ea8e299e86d0a7a36e29217daf86692c2ae19347651daa67996395f172";
const SESSION_KEY = "aquarius-admin-session";

const firebaseConfig = {
  apiKey: "AIzaSyChfVVyZJEZSP70TC4JctnGHT47GhLO7c8",
  authDomain: "aquarius-7e466.firebaseapp.com",
  databaseURL: "https://aquarius-7e466-default-rtdb.firebaseio.com",
  projectId: "aquarius-7e466",
  storageBucket: "aquarius-7e466.firebasestorage.app",
  messagingSenderId: "180363672724",
  appId: "1:180363672724:web:d516ba34e82743c0af4881",
  measurementId: "G-9Z1DTMNEHC"
};

const loginCard = document.getElementById("loginCard");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");
const logoutButton = document.getElementById("logoutButton");
const orderForm = document.getElementById("orderForm");
const orderMessage = document.getElementById("orderMessage");
const ordersTableBody = document.getElementById("ordersTableBody");
const orderDetail = document.getElementById("orderDetail");

const app = firebase.initializeApp(firebaseConfig);
const database = firebase.database(app);
const ordersRef = database.ref("orders");

let orders = [];
let selectedOrderId = null;

async function sha256(value) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

function setLoggedInState(isLoggedIn) {
  loginCard.classList.toggle("hidden", isLoggedIn);
  dashboard.classList.toggle("hidden", !isLoggedIn);
}

function setMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("error", isError);
}

function setOrderMessage(text, isError = false) {
  orderMessage.textContent = text;
  orderMessage.classList.toggle("error", isError);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createStatusOptions(selectedStatus) {
  return ["belum", "prosess", "selesai"]
    .map((status) => `<option value="${status}"${status === selectedStatus ? " selected" : ""}>${status}</option>`)
    .join("");
}

function formatDate(timestamp) {
  if (!timestamp) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(timestamp));
}

function renderOrderDetail(orderId) {
  const order = orders.find((item) => item.id === orderId);
  if (!order) {
    orderDetail.className = "order-detail empty-detail";
    orderDetail.innerHTML = "<p>Belum ada pesanan yang dipilih.</p>";
    return;
  }

  selectedOrderId = order.id;
  orderDetail.className = "order-detail";
  orderDetail.innerHTML = `
    <div class="detail-grid">
      <div class="detail-item">
        <span class="detail-label">Nama</span>
        <div class="detail-value">${escapeHtml(order.name)}</div>
      </div>
      <div class="detail-item">
        <span class="detail-label">Deskripsi</span>
        <div class="detail-value detail-description">${escapeHtml(order.description)}</div>
      </div>
      <div class="detail-item">
        <span class="detail-label">Status</span>
        <select class="status-select" data-id="${order.id}" aria-label="Status pesanan">
          ${createStatusOptions(order.status)}
        </select>
      </div>
      <div class="detail-item">
        <span class="detail-label">Dibuat</span>
        <div class="detail-value">${formatDate(order.createdAt)}</div>
      </div>
    </div>
  `;
}

function renderOrders() {
  if (!orders.length) {
    ordersTableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="3">Belum ada pesanan.</td>
      </tr>
    `;
    renderOrderDetail(null);
    return;
  }

  if (!selectedOrderId || !orders.some((order) => order.id === selectedOrderId)) {
    selectedOrderId = orders[0].id;
  }

  ordersTableBody.innerHTML = orders
    .map((order, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(order.name)}</td>
        <td><button class="detail-button" type="button" data-id="${order.id}">Lihat</button></td>
      </tr>
    `)
    .join("");

  renderOrderDetail(selectedOrderId);
}

function subscribeOrders() {
  ordersRef.on(
    "value",
    (snapshot) => {
      const data = snapshot.val() || {};
      orders = Object.entries(data)
        .map(([id, order]) => ({
          id,
          name: order.name || "",
          description: order.description || "",
          status: order.status || "belum",
          createdAt: order.createdAt || 0,
        }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      renderOrders();
      setOrderMessage("");
    },
    () => {
      setOrderMessage("Gagal mengambil data dari Firebase.", true);
    }
  );
}

function handleDetailClick(event) {
  const button = event.target.closest(".detail-button");
  if (!button) {
    return;
  }

  renderOrderDetail(button.dataset.id);
}

function handleStatusChange(event) {
  const select = event.target.closest(".status-select");
  if (!select) {
    return;
  }

  ordersRef.child(select.dataset.id).update({
    status: select.value,
  });
}

function handleCreateOrder(event) {
  event.preventDefault();

  const formData = new FormData(orderForm);
  const name = String(formData.get("orderName") || "").trim();
  const description = String(formData.get("orderDescription") || "").trim();

  if (!name || !description) {
    setOrderMessage("Nama dan deskripsi pesanan wajib diisi.", true);
    return;
  }

  const newOrderRef = ordersRef.push();
  newOrderRef.set({
    name,
    description,
    status: "belum",
    createdAt: Date.now(),
  }).then(() => {
    orderForm.reset();
    setOrderMessage("Pesanan berhasil dibuat.");
  }).catch(() => {
    setOrderMessage("Pesanan gagal disimpan ke Firebase.", true);
  });
}

async function handleLogin(event) {
  event.preventDefault();

  const formData = new FormData(loginForm);
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");

  if (!username || !password) {
    setMessage("Username dan password wajib diisi.", true);
    return;
  }

  const [usernameHash, passwordHash] = await Promise.all([
    sha256(username),
    sha256(password),
  ]);

  if (usernameHash === USERNAME_HASH && passwordHash === PASSWORD_HASH) {
    localStorage.setItem(SESSION_KEY, "ok");
    setMessage("");
    loginForm.reset();
    setLoggedInState(true);
    return;
  }

  setMessage("Username atau password salah.", true);
}

function handleLogout() {
  localStorage.removeItem(SESSION_KEY);
  setLoggedInState(false);
}

function restoreSession() {
  const isLoggedIn = localStorage.getItem(SESSION_KEY) === "ok";
  setLoggedInState(isLoggedIn);
}

loginForm.addEventListener("submit", handleLogin);
logoutButton.addEventListener("click", handleLogout);
orderForm.addEventListener("submit", handleCreateOrder);
ordersTableBody.addEventListener("click", handleDetailClick);
orderDetail.addEventListener("change", handleStatusChange);
subscribeOrders();
restoreSession();
