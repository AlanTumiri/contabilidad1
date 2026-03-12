const sections = ["usuarios", "configuracion", "plan_cuentas", "balance_inicial", "libro_diario", "libro_mayor", "hoja_trabajo", "estado_resultados", "balance_general", "inventario", "ayuda"];
function showSection(id, el) {
  sections.forEach(sec => {
    const node = document.getElementById(sec);
    if (node) node.style.display = "none";
  });

  document.getElementById(id).style.display = "block";
  document.querySelectorAll(".sidebar nav a").forEach(a => a.classList.remove("active"));
  if (el) el.classList.add("active");

  if (id === "usuarios") renderUsuarios();
  if (id === "configuracion") renderConfiguracion();
  if (id === "plan_cuentas") renderCuentas();
  if (id === "balance_inicial") { cargarSelectCuentas("selectCuentaBalance"); renderBalanceInicial(); }
  if (id === "libro_diario") { cargarSelectCuentas("asientoCuenta"); renderLibroDiarioSinTotales(); }
  if (id === "libro_mayor") { renderSelectMayor(); document.getElementById("balanzaContainer").style.display = "none"; }
  if (id === "hoja_trabajo") renderHojaTrabajo();
  if (id === "estado_resultados") { document.getElementById("estadoResultadosContainer").style.display = "none"; }
  if (id === "balance_general") { document.getElementById("balanceGeneralContainer").style.display = "none"; }
  if (id === "inventario") renderInventario();
}

function cerrarSesion() {
  localStorage.removeItem("py_session");
  window.location.href = "login.html";
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}

function formatMoney(num) {
  return Number(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function determinarNaturaleza(codigo) {
  const c = String(codigo).trim();
  if (c.startsWith("1") || c.startsWith("5") || c.startsWith("6")) return "deudora";
  if (c.startsWith("2") || c.startsWith("3") || c.startsWith("4")) return "acreedora";
  return "deudora";
}

// ====== BASES DE DATOS ======
function cargarDB(key, defaultData) {
  try {
    const d = localStorage.getItem(key);
    return d ? JSON.parse(d) : defaultData;
  } catch (error) {
    console.error(`Error leyendo ${key} desde localStorage:`, error);
    return defaultData;
  }
}

function guardarDB(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ====== MOTOR DE SINCRONIZACIÓN ======
function obtenerTodosLosMovimientos() {
  let movimientos = [];

  const balance = cargarDB("py_balance", []);
  balance.forEach(b => {
    let nat = determinarNaturaleza(b.codigo);
    let debe = (nat === "deudora") ? b.saldo : 0;
    let haber = (nat === "acreedora") ? b.saldo : 0;

    movimientos.push({
      fecha: "Apertura",
      codigo: b.codigo,
      cuenta: b.cuenta,
      folio: "AP",
      debe: debe,
      haber: haber,
      detalle: "Asiento Automático de Apertura"
    });
  });

  const diario = cargarDB("py_diario", []);
  movimientos = movimientos.concat(diario);

  return movimientos;
}

// ====== 1. USUARIOS ======
function cargarUsuarios() {
  return cargarDB("py_users", [{ "usuario": "admin", "contrasena": "admin123", "rol": "Administrador" }]);
}

function renderUsuarios() {
  const u = cargarUsuarios();
  const t = document.getElementById("usuariosBody");
  t.innerHTML = u.map(x => `<tr><td>${escapeHtml(x.usuario)}</td><td>********</td><td>${escapeHtml(x.rol)}</td></tr>`).join("");
}

function guardarUsuario() {
  const nu = document.getElementById("nuevo_usuario").value.trim();
  const nc = document.getElementById("nueva_contra").value.trim();
  const r = document.getElementById("nuevo_rol").value;

  if (!nu || !nc) return alert("Debes completar ambos campos.");

  const u = cargarUsuarios();
  if (u.find(x => x.usuario === nu)) return alert("Ya existe un usuario con ese nombre.");

  u.push({ usuario: nu, contrasena: nc, rol: r });
  guardarDB("py_users", u);
  renderUsuarios();

  document.getElementById("nuevo_usuario").value = "";
  document.getElementById("nueva_contra").value = "";
}

function eliminarUsuarioInput() {
  const n = document.getElementById("usuario_eliminar").value.trim();
  if (!n) return alert("Ingresa un nombre.");

  const u = cargarUsuarios();
  if (!u.find(x => x.usuario === n)) return alert("Ese usuario no existe.");
  if (u.length === 1) return alert("Error: No puedes eliminar el único usuario del sistema.");

  guardarDB("py_users", u.filter(x => x.usuario !== n));
  renderUsuarios();
  document.getElementById("usuario_eliminar").value = "";
  alert("Usuario eliminado.");
}

// ====== 2. CONFIGURACION ======
function cargarConfiguracion() {
  const defaults = {
    nombre: "Panadería Chelo",
    rubro: "-",
    direccion: "-",
    telefono: "-",
    correo: "-",
    representante: "-",
    logo: ""
  };

  const configGuardada = cargarDB("py_config", defaults);

  if (!configGuardada || typeof configGuardada !== "object" || Array.isArray(configGuardada)) {
    guardarDB("py_config", defaults);
    return { ...defaults };
  }

  return { ...defaults, ...configGuardada };
}

function renderConfiguracion() {
  const c = cargarConfiguracion();

  const editNombre = document.getElementById("editNombre");
  const editRubro = document.getElementById("editRubro");
  const editDireccion = document.getElementById("editDireccion");
  const editTelefono = document.getElementById("editTelefono");
  const editCorreo = document.getElementById("editCorreo");
  const editRepresentante = document.getElementById("editRepresentante");

  if (editNombre) editNombre.value = c.nombre || "";
  if (editRubro) editRubro.value = c.rubro || "";
  if (editDireccion) editDireccion.value = c.direccion || "";
  if (editTelefono) editTelefono.value = c.telefono || "";
  if (editCorreo) editCorreo.value = c.correo || "";
  if (editRepresentante) editRepresentante.value = c.representante || "";
}

function aplicarConfiguracionUI() {
  const c = cargarConfiguracion();
  const tituloSidebar = document.getElementById("sidebarEmpresa");
  const logoSidebar = document.getElementById("sidebarLogo");

  if (tituloSidebar) {
    tituloSidebar.textContent = c.nombre.toUpperCase();
  }

  if (logoSidebar) {
    if (c.logo) {
      logoSidebar.src = c.logo;
      logoSidebar.style.display = "block";
    } else {
      logoSidebar.style.display = "none";
    }
  }
}

// ESTA ES LA FUNCIÓN DEL BOTÓN QUE DEBE ESTAR EXACTAMENTE ASÍ
window.guardarConfiguracion = function() {
  const c = cargarConfiguracion();

  c.nombre = document.getElementById("editNombre").value.trim() || "Panadería Chelo";
  c.rubro = document.getElementById("editRubro").value.trim() || "-";
  c.direccion = document.getElementById("editDireccion").value.trim() || "-";
  c.telefono = document.getElementById("editTelefono").value.trim() || "-";
  c.correo = document.getElementById("editCorreo").value.trim() || "-";
  c.representante = document.getElementById("editRepresentante").value.trim() || "-";

  const l = document.getElementById("editLogo");

  if (l && l.files && l.files[0]) {
    const r = new FileReader();
    r.onload = function (e) {
      c.logo = e.target.result || "";
      guardarDB("py_config", c);
      alert("Datos y logo guardados correctamente.");
      renderConfiguracion();
      aplicarConfiguracionUI();
    };
    r.readAsDataURL(l.files[0]);
  } else {
    guardarDB("py_config", c);
    alert("Datos guardados correctamente.");
    renderConfiguracion();
    aplicarConfiguracionUI();
  }
};

function guardarConfiguracion() {
  const c = cargarConfiguracion();

  c.nombre = document.getElementById("editNombre").value.trim() || "Panadería Chelo";
  c.rubro = document.getElementById("editRubro").value.trim() || "-";
  c.direccion = document.getElementById("editDireccion").value.trim() || "-";
  c.telefono = document.getElementById("editTelefono").value.trim() || "-";
  c.correo = document.getElementById("editCorreo").value.trim() || "-";
  c.representante = document.getElementById("editRepresentante").value.trim() || "-";

  const l = document.getElementById("editLogo");

  if (l.files && l.files[0]) {
    const r = new FileReader();
    r.onload = function (e) {
      c.logo = e.target.result || "";
      guardarDB("py_config", c);
      alert("Datos guardados correctamente.");
      renderConfiguracion();
      aplicarConfiguracionUI(); 
    };
    r.readAsDataURL(l.files[0]);
  } else {
    guardarDB("py_config", c);
    alert("Datos guardados correctamente.");
    renderConfiguracion();
    aplicarConfiguracionUI(); 
  }
}
// ====== 3. PLAN DE CUENTAS ======
function cargarCuentas() {
  return cargarDB("py_cuentas", [
    { codigo: "1", nombre: "ACTIVO" },
    { codigo: "1.1.01", nombre: "Caja" },
    { codigo: "2", nombre: "PASIVO" },
    { codigo: "3", nombre: "PATRIMONIO" },
    { codigo: "4", nombre: "INGRESOS" },
    { codigo: "5", nombre: "GASTOS" },
    { codigo: "6", nombre: "COSTOS" }
  ]);
}

function renderCuentas() {
  const c = cargarCuentas();
  c.sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
  document.getElementById("cuentasBody").innerHTML = c.map(x => `<tr><td>${x.codigo}</td><td>${x.nombre}</td></tr>`).join("");
}

function guardarCuenta() {
  const cod = document.getElementById("nueva_cuenta_codigo").value.trim();
  const nom = document.getElementById("nueva_cuenta_nombre").value.trim();
  if (!cod || !nom) return alert("Faltan datos.");

  const c = cargarCuentas();
  if (c.find(x => x.codigo === cod)) return alert("Código existe.");

  c.push({ codigo: cod, nombre: nom });
  guardarDB("py_cuentas", c);
  renderCuentas();

  document.getElementById("nueva_cuenta_codigo").value = "";
  document.getElementById("nueva_cuenta_nombre").value = "";
}

function eliminarCuentaInput() {
  const n = document.getElementById("cuenta_eliminar").value.trim();
  if (!n) return alert("Ingrese dato.");

  const c = cargarCuentas();
  const cuentaTarget = c.find(x => x.codigo === n || x.nombre === n);
  if (!cuentaTarget) return alert("No se encontró una cuenta con ese código o nombre.");

  const enBalance = cargarDB("py_balance", []).some(b => b.codigo === cuentaTarget.codigo);
  const enDiario = cargarDB("py_diario", []).some(d => d.codigo === cuentaTarget.codigo);
  if (enBalance || enDiario) {
    return alert(`PROTECCIÓN DEL SISTEMA: No puedes eliminar la cuenta "${cuentaTarget.nombre}" porque ya tiene dinero en el Balance Inicial o en el Libro Diario. Debes borrar sus registros primero.`);
  }

  guardarDB("py_cuentas", c.filter(x => x.codigo !== cuentaTarget.codigo));
  renderCuentas();
  document.getElementById("cuenta_eliminar").value = "";
  alert("Cuenta eliminada con éxito.");
}

function cargarSelectCuentas(selectId) {
  const c = cargarCuentas().sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
  document.getElementById(selectId).innerHTML = c.map(x => `<option value="${x.codigo}|${x.nombre}">${x.codigo} - ${x.nombre}</option>`).join("");
}

function exportarCuentasPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("PLAN DE CUENTAS - EXPORTADO", 20, 20);
  let y = 30;

  cargarCuentas().sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true })).forEach(c => {
    if (y > 280) { doc.addPage(); y = 20; }
    doc.text(`${c.codigo} - ${c.nombre}`, 20, y);
    y += 7;
  });

  doc.save("Plan_Cuentas.pdf");
}

// ====== 4. BALANCE INICIAL ======
function renderBalanceInicial() {
  const b = cargarDB("py_balance", []);
  document.getElementById("balanceBody").innerHTML = b.map(x => `<tr><td>${x.codigo}</td><td>${x.cuenta}</td><td>${x.saldo}</td></tr>`).join("");

  let tA = 0, tP = 0, tC = 0;
  b.forEach(x => {
    if (x.codigo.startsWith("1")) tA += x.saldo;
    else if (x.codigo.startsWith("2")) tP += x.saldo;
    else if (x.codigo.startsWith("3")) tC += x.saldo;
  });

  document.getElementById("totActivo").textContent = tA.toFixed(2);
  document.getElementById("totPasivo").textContent = tP.toFixed(2);
  document.getElementById("totCapital").textContent = tC.toFixed(2);

  const m = document.getElementById("mensaje_ecuacion_contable");
  if (tA === tP + tC && tA > 0) {
    m.style.color = "green";
    m.innerHTML = `La ecuación contable se cumple: Activo = Pasivo + Capital = ${tA}`;
  } else if (tA > 0 || tP > 0 || tC > 0) {
    m.style.color = "red";
    m.innerHTML = `La ecuación contable no se cumple: Activo = ${tA}, Pasivo + Capital = ${tP + tC}`;
  } else {
    m.innerHTML = "";
  }
}

function agregarSaldoInicial() {
  const sel = document.getElementById("selectCuentaBalance").value;
  const monto = parseFloat(document.getElementById("montoBalance").value);
  if (!sel || isNaN(monto) || monto <= 0) return;

  const [codigo, nombre] = sel.split("|");
  const b = cargarDB("py_balance", []);
  b.push({ codigo: codigo, cuenta: nombre, saldo: monto });
  guardarDB("py_balance", b);
  renderBalanceInicial();
}

function eliminarSaldoInput() {
  const idx = parseInt(document.getElementById("balance_eliminar").value);
  const b = cargarDB("py_balance", []);
  if (isNaN(idx) || idx < 0 || idx >= b.length) return alert("Índice inválido.");

  b.splice(idx, 1);
  guardarDB("py_balance", b);
  renderBalanceInicial();
  document.getElementById("balance_eliminar").value = "";
}

// ====== 5. LIBRO DIARIO ======
function renderLibroDiarioSinTotales() {
  const d = cargarDB("py_diario", []);
  document.getElementById("libroDiarioBody").innerHTML = d.map((x, i) => `<tr><td>${i}</td><td>${x.fecha}</td><td>${x.codigo}</td><td>${x.cuenta}</td><td>${x.folio}</td><td>${x.debe}</td><td>${x.haber}</td><td>${x.detalle}</td></tr>`).join("");
  document.getElementById("diarioTotalesContainer").style.display = "none";
}

function guardarAsiento() {
  const f = document.getElementById("asientoFecha").value;
  const sel = document.getElementById("asientoCuenta").value;
  const fol = document.getElementById("asientoFolio").value;
  const d = parseFloat(document.getElementById("asientoDebe").value) || 0;
  const h = parseFloat(document.getElementById("asientoHaber").value) || 0;
  const det = document.getElementById("asientoDetalle").value;

  if (!f || !sel) return alert("Faltan datos.");

  const [cod, nom] = sel.split("|");
  const diario = cargarDB("py_diario", []);
  diario.push({ fecha: f, codigo: cod, cuenta: nom, folio: fol, debe: d, haber: h, detalle: det });
  guardarDB("py_diario", diario);
  renderLibroDiarioSinTotales();

  document.getElementById("asientoDebe").value = "0.00";
  document.getElementById("asientoHaber").value = "0.00";
  document.getElementById("asientoDetalle").value = "";
}

function eliminarAsientoInput() {
  const idx = parseInt(document.getElementById("asiento_eliminar").value);
  const d = cargarDB("py_diario", []);
  if (isNaN(idx) || idx < 0 || idx >= d.length) return alert("ID no existe.");

  d.splice(idx, 1);
  guardarDB("py_diario", d);
  renderLibroDiarioSinTotales();
  document.getElementById("asiento_eliminar").value = "";
  alert("Asiento eliminado.");
}

function verificarTotalesDiario() {
  const d = cargarDB("py_diario", []);
  let tD = 0, tH = 0;

  d.forEach(x => { tD += x.debe; tH += x.haber; });

  document.getElementById("diarioTotalesContainer").style.display = "block";
  document.getElementById("totLibroDebe").textContent = tD.toFixed(2);
  document.getElementById("totLibroHaber").textContent = tH.toFixed(2);

  const m = document.getElementById("estadoCuadreLibro");
  if (Math.abs(tD - tH) < 0.01 && tD > 0) {
    m.style.color = "green";
    m.innerHTML = "Los montos cuadran perfectamente.";
  } else if (tD === 0 && tH === 0) {
    m.style.color = "gray";
    m.innerHTML = "Sin datos.";
  } else {
    m.style.color = "red";
    m.innerHTML = "Los montos NO cuadran. Revise los asientos.";
  }
}

function exportarDiarioExcel() {
  const d = cargarDB("py_diario", []);
  const ws = XLSX.utils.json_to_sheet(d);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "LibroDiario");
  XLSX.writeFile(wb, "Libro_Diario.xlsx");
}

function exportarDiarioPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("LIBRO DIARIO", 20, 20);
  let y = 30;

  cargarDB("py_diario", []).forEach(x => {
    if (y > 280) { doc.addPage(); y = 20; }
    doc.text(`${x.fecha} | ${x.cuenta} | D:${x.debe} | H:${x.haber}`, 20, y);
    y += 7;
  });

  doc.save("Libro_Diario.pdf");
}

// ====== 6. LIBRO MAYOR ======
function renderSelectMayor() {
  const d = obtenerTodosLosMovimientos();
  const ctas = [...new Set(d.map(x => x.cuenta))];
  document.getElementById("selectMayorCuenta").innerHTML = `<option value="">Seleccione...</option>` + ctas.map(c => `<option value="${c}">${c}</option>`).join("");
  document.getElementById("mayorCuentaBody").innerHTML = "";
}

function renderMayorPorCuenta() {
  const sel = document.getElementById("selectMayorCuenta").value;
  if (!sel) return;

  const movs = obtenerTodosLosMovimientos().filter(x => x.cuenta === sel);
  if (movs.length === 0) return;
  
  // Identificamos la naturaleza de la cuenta para saber si suma o resta
  const codigo = movs[0].codigo;
  const nat = determinarNaturaleza(codigo);
  let saldo = 0;

  document.getElementById("mayorCuentaBody").innerHTML = movs.map(m => {
    if (nat === "deudora") {
      saldo += (m.debe - m.haber);
    } else {
      saldo += (m.haber - m.debe);
    }
    
    // Agregamos la nueva columna de saldo al final
    return `<tr><td>${m.fecha}</td><td>${m.folio}</td><td>${m.detalle}</td><td>${m.debe.toFixed(2)}</td><td>${m.haber.toFixed(2)}</td><td><strong>${saldo.toFixed(2)}</strong></td></tr>`;
  }).join("");
}

function renderBalanzaComprobacion() {
  const d = obtenerTodosLosMovimientos();
  const r = {};

  d.forEach(m => {
    if (!r[m.codigo]) r[m.codigo] = { cuenta: m.cuenta, d: 0, h: 0, nat: determinarNaturaleza(m.codigo) };
    r[m.codigo].d += m.debe;
    r[m.codigo].h += m.haber;
  });

  const arr = Object.keys(r).map(k => ({ codigo: k, ...r[k] })).sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
  
  // Variables para las 4 columnas
  let tD = 0, tH = 0, tSD = 0, tSA = 0; 

  document.getElementById("balanzaBody").innerHTML = arr.map(x => {
    tD += x.d;
    tH += x.h;
    
    let sDeudor = 0, sAcreedor = 0;
    
    // Calculamos si el saldo final queda en el Deudor o el Acreedor
    if (x.nat === "deudora") {
        sDeudor = x.d - x.h;
        if (sDeudor < 0) { sAcreedor = Math.abs(sDeudor); sDeudor = 0; } // Por si hay sobregiro
    } else {
        sAcreedor = x.h - x.d;
        if (sAcreedor < 0) { sDeudor = Math.abs(sAcreedor); sAcreedor = 0; }
    }

    tSD += sDeudor;
    tSA += sAcreedor;

    // Generamos las 4 columnas de datos
    return `<tr><td>${x.codigo}</td><td>${x.cuenta}</td><td>${x.d.toFixed(2)}</td><td>${x.h.toFixed(2)}</td><td>${sDeudor.toFixed(2)}</td><td>${sAcreedor.toFixed(2)}</td></tr>`;
  }).join("");

  // Actualizamos totales en pantalla
  document.getElementById("totSumasDebe").textContent = tD.toFixed(2);
  document.getElementById("totSumasHaber").textContent = tH.toFixed(2);
  
  const elSD = document.getElementById("totSaldosDeudor");
  const elSA = document.getElementById("totSaldosAcreedor");
  if(elSD) elSD.textContent = tSD.toFixed(2);
  if(elSA) elSA.textContent = tSA.toFixed(2);

  document.getElementById("balanzaContainer").style.display = "block";

  // Verificamos que tanto Sumas como Saldos cuadren
  const m = document.getElementById("mensaje_balanza_cuadre");
  if (Math.abs(tD - tH) < 0.01 && Math.abs(tSD - tSA) < 0.01 && tD > 0) {
    m.style.color = "green";
    m.innerHTML = "La Balanza de Sumas y Saldos está PERFECTAMENTE CUADRADA.";
  } else {
    m.style.color = "red";
    m.innerHTML = "La Balanza NO Cuadra. Revise los movimientos en el Diario.";
  }
}

// ====== 7. HOJA DE TRABAJO ======
function renderHojaTrabajo() {
  const d = obtenerTodosLosMovimientos();
  const aj = cargarDB("py_ajustes", {});
  const r = {};

  d.forEach(m => {
    if (!r[m.codigo]) r[m.codigo] = { cuenta: m.cuenta, s: 0, nat: determinarNaturaleza(m.codigo) };
    if (r[m.codigo].nat === "deudora") r[m.codigo].s += (m.debe - m.haber);
    else r[m.codigo].s += (m.haber - m.debe);
  });

  const arr = Object.keys(r).map(k => ({ codigo: k, cuenta: r[k].cuenta, s: r[k].s + (aj[k] || 0) })).sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
  document.getElementById("hojaTrabajoBody").innerHTML = arr.map(x => `<tr><td>${x.codigo}</td><td>${x.cuenta}</td><td>${x.s.toFixed(2)}</td></tr>`).join("");
}

function aplicarAjuste() {
  const c = document.getElementById("ajusteCodigo").value.trim();
  const m = parseFloat(document.getElementById("ajusteMonto").value);
  if (!c || isNaN(m)) return alert("Por favor ingrese un código y un monto válidos.");

  const aj = cargarDB("py_ajustes", {});
  aj[c] = (aj[c] || 0) + m;
  guardarDB("py_ajustes", aj);

  renderHojaTrabajo();
  document.getElementById("ajusteCodigo").value = "";
  document.getElementById("ajusteMonto").value = "";
}

function exportarHojaPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("HOJA DE TRABAJO", 20, 20);
  doc.save("Hoja_Trabajo.pdf");
}

// ====== 7.5 ESTADO DE RESULTADOS ======
function renderEstadoResultados() {
  const d = obtenerTodosLosMovimientos();
  const aj = cargarDB("py_ajustes", {});
  const r = {};

  d.forEach(m => {
    if (!r[m.codigo]) r[m.codigo] = { cuenta: m.cuenta, d: 0, h: 0 };
    r[m.codigo].d += m.debe;
    r[m.codigo].h += m.haber;
  });

  let htmlI = "", htmlC = "", htmlG = "";
  let tI = 0, tC = 0, tG = 0;

  Object.keys(r).sort().forEach(k => {
    let nat = determinarNaturaleza(k);
    let saldo = 0;
    let ajuste_cuenta = aj[k] || 0;

    if (nat === "deudora") saldo = (r[k].d - r[k].h) + ajuste_cuenta;
    else saldo = (r[k].h - r[k].d) + ajuste_cuenta;

    if (k.startsWith("4") && saldo !== 0) { tI += saldo; htmlI += `<tr><td>${r[k].cuenta}</td><td>${saldo.toFixed(2)}</td></tr>`; }
    if (k.startsWith("6") && saldo !== 0) { tC += saldo; htmlC += `<tr><td>${r[k].cuenta}</td><td>${saldo.toFixed(2)}</td></tr>`; }
    if (k.startsWith("5") && saldo !== 0) { tG += saldo; htmlG += `<tr><td>${r[k].cuenta}</td><td>${saldo.toFixed(2)}</td></tr>`; }
  });

  document.getElementById("erIngresosBody").innerHTML = htmlI || `<tr><td colspan="2">Sin ingresos</td></tr>`;
  document.getElementById("erCostosBody").innerHTML = htmlC || `<tr><td colspan="2">Sin costos</td></tr>`;
  document.getElementById("erGastosBody").innerHTML = htmlG || `<tr><td colspan="2">Sin gastos</td></tr>`;

  let utilidadBruta = tI - tC;
  let utilidadNeta = utilidadBruta - tG;

  document.getElementById("erUtilidadBruta").textContent = `Bs ${utilidadBruta.toFixed(2)}`;
  
  const utilNetaEl = document.getElementById("erUtilidadNeta");
  utilNetaEl.textContent = `Bs ${utilidadNeta.toFixed(2)}`;
  
  if(utilidadNeta < 0) {
    utilNetaEl.style.color = "#c62828";
    utilNetaEl.parentElement.querySelector("h3").textContent = "PÉRDIDA NETA DEL EJERCICIO";
  } else {
    utilNetaEl.style.color = "var(--sidebar-color)";
    utilNetaEl.parentElement.querySelector("h3").textContent = "UTILIDAD NETA DEL EJERCICIO";
  }

  document.getElementById("estadoResultadosContainer").style.display = "block";
}

// ====== 8. BALANCE GENERAL ======
function renderBalanceGeneral() {
  const d = obtenerTodosLosMovimientos();
  const aj = cargarDB("py_ajustes", {});
  const r = {};

  d.forEach(m => {
    if (!r[m.codigo]) r[m.codigo] = { cuenta: m.cuenta, d: 0, h: 0 };
    r[m.codigo].d += m.debe;
    r[m.codigo].h += m.haber;
  });

  let tA = 0, tP = 0, tC = 0, tI = 0, tG = 0, htmlA = "", htmlP = "", htmlC = "";

  Object.keys(r).sort().forEach(k => {
    let nat = determinarNaturaleza(k);
    let saldo = 0;
    let ajuste_cuenta = aj[k] || 0;

    if (nat === "deudora") saldo = (r[k].d - r[k].h) + ajuste_cuenta;
    else saldo = (r[k].h - r[k].d) + ajuste_cuenta;

    if (k.startsWith("1") && saldo != 0) { tA += saldo; htmlA += `<tr><td>${r[k].cuenta}</td><td>${saldo.toFixed(2)}</td></tr>`; }
    if (k.startsWith("2") && saldo != 0) { tP += saldo; htmlP += `<tr><td>${r[k].cuenta}</td><td>${saldo.toFixed(2)}</td></tr>`; }
    if (k.startsWith("3") && saldo != 0) { tC += saldo; htmlC += `<tr><td>${r[k].cuenta}</td><td>${saldo.toFixed(2)}</td></tr>`; }
    if (k.startsWith("4")) tI += saldo;
    if (k.startsWith("5") || k.startsWith("6")) tG += saldo;
  });

  let util = tI - tG;
  tC += util;
  htmlC += `<tr><td><strong>Resultado del Período</strong></td><td><strong>${util.toFixed(2)}</strong></td></tr>`;

  document.getElementById("bgActivosBody").innerHTML = htmlA || `<tr><td colspan="2">Sin cuentas de activo</td></tr>`;
  document.getElementById("bgPasivosBody").innerHTML = htmlP || `<tr><td colspan="2">Sin cuentas de pasivo</td></tr>`;
  document.getElementById("bgPatrimonioBody").innerHTML = htmlC;

  document.getElementById("bgTotActivo").textContent = tA.toFixed(2);
  document.getElementById("bgTotPasPat").textContent = (tP + tC).toFixed(2);
  document.getElementById("balanceGeneralContainer").style.display = "block";

  const m = document.getElementById("mensaje_balance_cuadre");
  if (Math.abs(tA - (tP + tC)) < 0.01 && tA > 0) {
    m.style.color = "green";
    m.innerHTML = "El Balance General está PERFECTAMENTE CUADRADO.";
  } else if (tA === 0 && tP === 0) {
    m.innerHTML = "Esperando cálculos.";
  } else {
    m.style.color = "red";
    m.innerHTML = `El Balance NO CUADRA. Hay una diferencia de ${Math.abs(tA - (tP + tC)).toFixed(2)}`;
  }
}

function exportarBalancePDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("BALANCE GENERAL", 20, 20);
  doc.save("Balance_General.pdf");
}

// ====== 9. INVENTARIO ======
function cargarInvProductos() {
  return cargarDB("py_inv_prod", [{ codigo: "PROD1", nombre: "Harina Mágica", categoria: "Materia Prima", stock: 100 }]);
}

function cargarInvMovimientos() {
  return cargarDB("py_inv_movs", []);
}

function renderInventario() {
  const p = cargarInvProductos();
  const m = cargarInvMovimientos();
  document.getElementById("invProducto").innerHTML = p.map(x => `<option value="${x.nombre}">${x.nombre}</option>`).join("");
  document.getElementById("invStockBody").innerHTML = p.map(x => `<tr><td>${x.codigo}</td><td>${x.nombre}</td><td>${x.categoria}</td><td>${x.stock}</td></tr>`).join("");
  document.getElementById("invMovsBody").innerHTML = m.map(x => `<tr><td>${x.fecha}</td><td>${x.producto}</td><td>${x.entrada}</td><td>${x.salida}</td><td>${x.detalle}</td></tr>`).join("");
}

function registrarMovimiento() {
  const prod = document.getElementById("invProducto").value;
  const tipo = document.getElementById("invTipoMov").value;
  const cant = parseInt(document.getElementById("invCantidad").value);
  const det = document.getElementById("invDetalle").value;

  const p = cargarInvProductos();
  const idx = p.findIndex(x => x.nombre === prod);
  let e = 0, s = 0;

  if (tipo === "Entrada") {
    p[idx].stock += cant;
    e = cant;
  } else {
    if (cant > p[idx].stock) return alert("No hay stock suficiente.");
    p[idx].stock -= cant;
    s = cant;
  }

  const m = cargarInvMovimientos();
  m.push({ fecha: new Date().toLocaleString(), producto: prod, entrada: e, salida: s, detalle: det });
  guardarDB("py_inv_prod", p);
  guardarDB("py_inv_movs", m);
  alert("Movimiento registrado con éxito.");
  renderInventario();
}

// ====== EXPORTACIONES INVENTARIO ======
function exportarInventarioExcel() {
  const p = cargarInvProductos();
  const ws = XLSX.utils.json_to_sheet(p);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventario");
  XLSX.writeFile(wb, "Inventario_Chelo.xlsx");
}

function exportarInventarioPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("INVENTARIO DE PANADERÍA", 20, 20);
  doc.save("Inventario.pdf");
}

// ====== INICIO ======
window.addEventListener("DOMContentLoaded", () => {
  const sesion = JSON.parse(localStorage.getItem("py_session"));

  if (!sesion || !sesion.activa) {
    window.location.href = "login.html";
    return;
  }

  const headerUserName = document.getElementById("headerUserName");
  if (headerUserName) {
    headerUserName.textContent = sesion.usuario + " - " + sesion.rol;
  }

  showSection("usuarios", document.querySelector(".sidebar nav a"));
});
