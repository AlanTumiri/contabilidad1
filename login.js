function cargarUsuarios() {
  const data = localStorage.getItem("py_users");
  return data
    ? JSON.parse(data)
    : [{ usuario: "admin", contrasena: "admin123", rol: "Administrador" }];
}

function iniciarSesion() {
  const usuario = document.getElementById("loginUsuario").value.trim();
  const contrasena = document.getElementById("loginContrasena").value.trim();
  const mensaje = document.getElementById("loginMensaje");

  mensaje.textContent = "";

  if (!usuario || !contrasena) {
    mensaje.textContent = "Completa usuario y contraseña.";
    return;
  }

  const usuarios = cargarUsuarios();

  const encontrado = usuarios.find(
    u => u.usuario === usuario && u.contrasena === contrasena
  );

  if (!encontrado) {
    mensaje.textContent = "Usuario o contraseña incorrectos.";
    return;
  }

  localStorage.setItem("py_session", JSON.stringify({
    usuario: encontrado.usuario,
    rol: encontrado.rol,
    activa: true
  }));

  window.location.href = "index.html";
}

window.addEventListener("DOMContentLoaded", () => {
  const sesion = JSON.parse(localStorage.getItem("py_session"));

  if (sesion && sesion.activa) {
    window.location.href = "index.html";
    return;
  }

  const form = document.getElementById("loginForm");
  if (form) {
    form.addEventListener("submit", function(e) {
      e.preventDefault();
      iniciarSesion();
    });
  }
});