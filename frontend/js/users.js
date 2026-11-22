/* Halaman Pengguna (khusus owner): atur peran owner / admin / viewer. */
const Users = {
  init() {},

  async load() {
    if (!App.can("owner")) return;
    try {
      App.state.users = await Backend.ambilPengguna();
    } catch (error) {
      showToast(`Gagal memuat pengguna: ${error.message}`, true);
    }
    this.render();
  },

  render() {
    const me = App.state.profile?.id;
    const rows = $("#userRows");
    const users = App.state.users || [];
    if (!users.length) {
      rows.innerHTML = '<tr><td colspan="4"><div class="empty"><strong>Belum ada pengguna</strong></div></td></tr>';
      return;
    }
    rows.innerHTML = users.map((u) => `<tr>
      <td><div class="who">${avatar(u.nama || u.email)}<div class="cell-main">${escapeHtml(u.nama || "—")}${u.id === me ? '<span class="tag new">Anda</span>' : ""}</div></div></td>
      <td>${escapeHtml(u.email)}</td>
      <td>${formatDate(u.created_at)}</td>
      <td>${u.id === me
        ? roleBadge(u.role)
        : `<select class="role-select" data-user="${u.id}">
            ${["owner", "admin", "viewer"].map((r) => `<option value="${r}" ${r === u.role ? "selected" : ""}>${r}</option>`).join("")}
          </select>`}</td>
    </tr>`).join("");
    $$("[data-user]", rows).forEach((select) => select.addEventListener("change", () => this.change(select)));
  },

  async change(select) {
    const user = App.state.users.find((u) => u.id === select.dataset.user);
    const role = select.value;
    if (role === "owner" && !window.confirm(`Jadikan ${user.email} owner? Owner bisa menghapus semua data.`)) {
      select.value = user.role;
      return;
    }
    select.disabled = true;
    try {
      await Backend.ubahPeran(user.id, role);
      showToast(`Peran ${user.email} diubah menjadi ${role}.`);
      await this.load();
    } catch (error) {
      select.value = user.role;
      select.disabled = false;
      showToast(`Gagal mengubah peran: ${error.message}`, true);
    }
  },
};
