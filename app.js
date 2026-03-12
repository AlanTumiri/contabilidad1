const sections = [
  "usuarios",
  "configuracion",
  "plan_cuentas",
  "balance_inicial",
  "libro_diario",
  "libro_mayor",
  "hoja_trabajo",
  "estado_resultados",
  "balance_general",
  "inventario",
  "ayuda"
];

function byId(id) {
  return document.getElementById(id);
}

function showSection(id, el) {
  sections.forEach(sec => {
    const node = byId(sec);
    if (node) node.style.display = "none";
  });

  const target = byId(id);
  if (target) target.style.display = "block";

  document.querySelectorAll(".sidebar nav a").forEach(a => a.classList.remove("active"));
  if (el) el.classList.add("active");

  if (id === "usuarios") renderUsuarios();
  if (id === "configuracion") renderConfiguracion();
  if (id === "plan_cuentas") renderCuentas();

  if (id === "balance_inicial") {
    cargarSelectCuentas("selectCuentaBalance", "apertura");
    renderBalanceInicial();
  }

  if (id === "libro_diario") {
    cargarSelectCuentas("asientoCuenta", "movimiento");
    renderLibroDiarioSinTotales();
  }

  if (id === "libro_mayor") {
    renderSelectMayor();
    renderBalanzaComprobacion();
    const balanza = byId("balanzaContainer");
    if (balanza) balanza.style.display = "block";
  }

  if (id === "hoja_trabajo") {
    cargarSelectCuentas("ajusteCuentaDebe", "movimiento");
    cargarSelectCuentas("ajusteCuentaHaber", "movimiento");
    renderHojaTrabajo();
    renderAjustes();
  }

  if (id === "estado_resultados") renderEstadoResultados();
  if (id === "balance_general") renderBalanceGeneral();

  if (id === "inventario") {
    renderInventario();
    cargarSelectCuentas("invCuentaInventario", "activo");
    cargarSelectCuentas("invCuentaContra", "movimiento");
  }
}

function cerrarSesion() {
  localStorage.removeItem("py_session");
  window.location.href = "login.html";
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (m) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[m];
  });
}

function formatMoney(num) {
  return Number(num || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function determinarNaturaleza(codigo) {
  const c = String(codigo).trim();
  if (c.startsWith("1") || c.startsWith("5") || c.startsWith("6")) return "deudora";
  if (c.startsWith("2") || c.startsWith("3") || c.startsWith("4")) return "acreedora";
  return "deudora";
}

function esCuentaTitulo(codigo) {
  const c = String(codigo).trim();
  return /^[1-6]$/.test(c);
}

function esCuentaOperativa(codigo) {
  const c = String(codigo).trim();
  return /^\d+(\.\d+)+$/.test(c);
}

function esCuentaAperturaValida(codigo) {
  const c = String(codigo).trim();
  return esCuentaOperativa(c) && (c.startsWith("1") || c.startsWith("2") || c.startsWith("3"));
}

function esCuentaMovimientoValida(codigo) {
  const c = String(codigo).trim();
  return esCuentaOperativa(c);
}

function esCuentaActivo(codigo) {
  return esCuentaOperativa(codigo) && String(codigo).startsWith("1");
}

function compararCodigos(a, b) {
  return a.localeCompare(b, undefined, { numeric: true });
}

// ====== BASE DE DATOS ======
function cargarDB(key, defaultData) {
  try {
    const d = localStorage.getItem(key);
    return d ? JSON.parse(d) : defaultData;
  } catch (error) {
    console.error(`Error leyendo ${key}:`, error);
    return defaultData;
  }
}

function guardarDB(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ====== SINCRONIZACIÓN ======
function recalcularTodo() {
  renderBalanceInicial();
  renderLibroDiarioSinTotales();
  renderSelectMayor();
  renderBalanzaComprobacion();
  renderHojaTrabajo();
  renderAjustes();
  renderEstadoResultados();
  renderBalanceGeneral();
  renderInventario();
}

// ====== MOTOR CONTABLE ======
function cargarAjustes() {
  return cargarDB("py_ajustes", []);
}

function obtenerMovimientosApertura() {
  const balance = cargarDB("py_balance", []);
  const movimientos = [];

  balance.forEach(b => {
    if (!esCuentaAperturaValida(b.codigo)) return;

    const nat = determinarNaturaleza(b.codigo);
    const debe = nat === "deudora" ? Number(b.saldo) || 0 : 0;
    const haber = nat === "acreedora" ? Number(b.saldo) || 0 : 0;

    movimientos.push({
      fecha: "Apertura",
      codigo: b.codigo,
      cuenta: b.cuenta,
      folio: "AP",
      debe,
      haber,
      detalle: "Asiento Automático de Apertura",
      origen: "apertura"
    });
  });

  return movimientos;
}

function obtenerMovimientosDiario() {
  return cargarDB("py_diario", []).map(x => ({
    ...x,
    debe: Number(x.debe) || 0,
    haber: Number(x.haber) || 0,
    origen: "diario"
  }));
}

function obtenerMovimientosAjuste() {
  const ajustes = cargarAjustes();
  const movimientos = [];

  ajustes.forEach((aj, i) => {
    movimientos.push({
      fecha: aj.fecha,
      codigo: aj.codigoDebe,
      cuenta: aj.cuentaDebe,
      folio: aj.folio || `AJ-${i + 1}`,
      debe: Number(aj.monto) || 0,
      haber: 0,
      detalle: aj.detalle || "Ajuste contable",
      origen: "ajuste"
    });

    movimientos.push({
      fecha: aj.fecha,
      codigo: aj.codigoHaber,
      cuenta: aj.cuentaHaber,
      folio: aj.folio || `AJ-${i + 1}`,
      debe: 0,
      haber: Number(aj.monto) || 0,
      detalle: aj.detalle || "Ajuste contable",
      origen: "ajuste"
    });
  });

  return movimientos;
}

function obtenerTodosLosMovimientos() {
  return [
    ...obtenerMovimientosApertura(),
    ...obtenerMovimientosDiario(),
    ...obtenerMovimientosAjuste()
  ];
}

function resumirCuadreDiario() {
  const d = obtenerMovimientosDiario();
  const porFolio = {};
  let totalDebe = 0;
  let totalHaber = 0;

  d.forEach(x => {
    const folio = String(x.folio || "SIN_FOLIO").trim();
    if (!porFolio[folio]) {
      porFolio[folio] = {
        debe: 0,
        haber: 0
      };
    }

    porFolio[folio].debe += Number(x.debe) || 0;
    porFolio[folio].haber += Number(x.haber) || 0;
    totalDebe += Number(x.debe) || 0;
    totalHaber += Number(x.haber) || 0;
  });

  const descuadrados = Object.keys(porFolio).filter(folio =>
    Math.abs(porFolio[folio].debe - porFolio[folio].haber) >= 0.01
  );

  return {
    totalDebe,
    totalHaber,
    porFolio,
    descuadrados,
    diarioCuadrado: Math.abs(totalDebe - totalHaber) < 0.01 && descuadrados.length === 0
  };
}

function puedeGenerarEstadosFinancieros() {
  const d = cargarDB("py_diario", []);
  if (d.length === 0) return true;
  return resumirCuadreDiario().diarioCuadrado;
}

function agruparSaldosPorCuenta() {
  const d = obtenerTodosLosMovimientos();
  const r = {};

  d.forEach(m => {
    if (!r[m.codigo]) {
      r[m.codigo] = {
        cuenta: m.cuenta,
        debe: 0,
        haber: 0,
        nat: determinarNaturaleza(m.codigo)
      };
    }
    r[m.codigo].debe += Number(m.debe) || 0;
    r[m.codigo].haber += Number(m.haber) || 0;
  });

  return r;
}

// ====== 1. USUARIOS ======
function cargarUsuarios() {
  return cargarDB("py_users", [
    { usuario: "admin", contrasena: "admin123", rol: "Administrador" }
  ]);
}

function renderUsuarios() {
  const u = cargarUsuarios();
  const t = byId("usuariosBody");
  if (!t) return;

  t.innerHTML = u.map(x =>
    `<tr><td>${escapeHtml(x.usuario)}</td><td>********</td><td>${escapeHtml(x.rol)}</td></tr>`
  ).join("");
}

function guardarUsuario() {
  const nu = byId("nuevo_usuario").value.trim();
  const nc = byId("nueva_contra").value.trim();
  const r = byId("nuevo_rol").value;

  if (!nu || !nc) return alert("Debes completar ambos campos.");

  const u = cargarUsuarios();
  if (u.find(x => x.usuario === nu)) return alert("Ya existe un usuario con ese nombre.");

  u.push({ usuario: nu, contrasena: nc, rol: r });
  guardarDB("py_users", u);
  renderUsuarios();

  byId("nuevo_usuario").value = "";
  byId("nueva_contra").value = "";
}

function eliminarUsuarioInput() {
  const n = byId("usuario_eliminar").value.trim();
  if (!n) return alert("Ingresa un nombre.");

  const u = cargarUsuarios();
  if (!u.find(x => x.usuario === n)) return alert("Ese usuario no existe.");
  if (u.length === 1) return alert("No puedes eliminar el único usuario del sistema.");

  guardarDB("py_users", u.filter(x => x.usuario !== n));
  renderUsuarios();
  byId("usuario_eliminar").value = "";
  alert("Usuario eliminado.");
}

// ====== 2. CONFIGURACIÓN ======
function cargarConfiguracion() {
  const defaults = {
    nombre: "Panadería Chelo",
    rubro: "-",
    direccion: "-",
    telefono: "-",
    correo: "-",
    representante: "-",
    logo: "",
    ivaPorcentaje: 13
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
  const ivaNode = byId("configIvaPorcentaje");
  if (ivaNode) ivaNode.textContent = Number(c.ivaPorcentaje || 13).toFixed(0);
  return c;
}

function aplicarConfiguracionUI() {
  const c = cargarConfiguracion();
  const tituloSidebar = byId("sidebarEmpresa");
  const logoSidebar = byId("sidebarLogo");

  if (tituloSidebar) tituloSidebar.textContent = (c.nombre || "Panadería Chelo").toUpperCase();

  if (logoSidebar) {
    if (c.logo) {
      logoSidebar.src = c.logo;
      logoSidebar.style.display = "block";
    } else {
      logoSidebar.style.display = "none";
    }
  }
}

// ====== 3. PLAN DE CUENTAS ======
function cargarCuentas() {
  return cargarDB("py_cuentas", [
    { codigo: "1", nombre: "ACTIVO" },
    { codigo: "1.1.01", nombre: "Caja" },
    { codigo: "1.1.02", nombre: "Inventarios" },
    { codigo: "1.1.03", nombre: "Crédito Fiscal IVA" },

    { codigo: "2", nombre: "PASIVO" },
    { codigo: "2.1.01", nombre: "Cuentas por Pagar" },
    { codigo: "2.1.02", nombre: "Débito Fiscal IVA" },

    { codigo: "3", nombre: "PATRIMONIO" },
    { codigo: "3.1.01", nombre: "Capital Social" },

    { codigo: "4", nombre: "INGRESOS" },
    { codigo: "4.1.01", nombre: "Ventas" },

    { codigo: "5", nombre: "GASTOS" },
    { codigo: "5.1.01", nombre: "Gastos Administrativos" },

    { codigo: "6", nombre: "COSTOS" },
    { codigo: "6.1.01", nombre: "Costo de Ventas" }
  ]);
}

function renderCuentas() {
  const c = cargarCuentas().sort((a, b) => compararCodigos(a.codigo, b.codigo));
  const body = byId("cuentasBody");
  if (!body) return;

  body.innerHTML = c.map(x =>
    `<tr><td>${escapeHtml(x.codigo)}</td><td>${escapeHtml(x.nombre)}</td></tr>`
  ).join("");
}

function guardarCuenta() {
  const cod = byId("nueva_cuenta_codigo").value.trim();
  const nom = byId("nueva_cuenta_nombre").value.trim();

  if (!cod || !nom) return alert("Faltan datos.");
  if (!/^\d+(\.\d+)*$/.test(cod)) return alert("El código de cuenta no tiene formato válido.");
  if (esCuentaTitulo(cod) && !["1","2","3","4","5","6"].includes(cod)) return alert("Código no válido.");

  const c = cargarCuentas();
  if (c.find(x => x.codigo === cod)) return alert("Ese código ya existe.");

  c.push({ codigo: cod, nombre: nom });
  guardarDB("py_cuentas", c);
  renderCuentas();

  cargarSelectCuentas("selectCuentaBalance", "apertura");
  cargarSelectCuentas("asientoCuenta", "movimiento");
  cargarSelectCuentas("ajusteCuentaDebe", "movimiento");
  cargarSelectCuentas("ajusteCuentaHaber", "movimiento");
  cargarSelectCuentas("invCuentaInventario", "activo");
  cargarSelectCuentas("invCuentaContra", "movimiento");

  byId("nueva_cuenta_codigo").value = "";
  byId("nueva_cuenta_nombre").value = "";
}

function eliminarCuentaInput() {
  const n = byId("cuenta_eliminar").value.trim();
  if (!n) return alert("Ingrese dato.");

  const c = cargarCuentas();
  const cuentaTarget = c.find(x => x.codigo === n || x.nombre === n);
  if (!cuentaTarget) return alert("No se encontró una cuenta con ese código o nombre.");
  if (esCuentaTitulo(cuentaTarget.codigo)) return alert("No puedes eliminar una cuenta título principal.");

  const enBalance = cargarDB("py_balance", []).some(b => b.codigo === cuentaTarget.codigo);
  const enDiario = cargarDB("py_diario", []).some(d => d.codigo === cuentaTarget.codigo);
  const enAjustes = cargarAjustes().some(a => a.codigoDebe === cuentaTarget.codigo || a.codigoHaber === cuentaTarget.codigo);

  if (enBalance || enDiario || enAjustes) {
    return alert(`No puedes eliminar la cuenta "${cuentaTarget.nombre}" porque ya tiene saldos o movimientos registrados.`);
  }

  guardarDB("py_cuentas", c.filter(x => x.codigo !== cuentaTarget.codigo));
  renderCuentas();

  cargarSelectCuentas("selectCuentaBalance", "apertura");
  cargarSelectCuentas("asientoCuenta", "movimiento");
  cargarSelectCuentas("ajusteCuentaDebe", "movimiento");
  cargarSelectCuentas("ajusteCuentaHaber", "movimiento");
  cargarSelectCuentas("invCuentaInventario", "activo");
  cargarSelectCuentas("invCuentaContra", "movimiento");

  byId("cuenta_eliminar").value = "";
  alert("Cuenta eliminada con éxito.");
}

function cargarSelectCuentas(selectId, modo = "movimiento") {
  const c = cargarCuentas()
    .filter(x => {
      if (modo === "apertura") return esCuentaAperturaValida(x.codigo);
      if (modo === "activo") return esCuentaActivo(x.codigo);
      if (modo === "movimiento") return esCuentaMovimientoValida(x.codigo);
      return true;
    })
    .sort((a, b) => compararCodigos(a.codigo, b.codigo));

  const select = byId(selectId);
  if (!select) return;

  if (!c.length) {
    select.innerHTML = `<option value="">Sin cuentas disponibles</option>`;
    return;
  }

  select.innerHTML = c.map(x =>
    `<option value="${escapeHtml(x.codigo)}|${escapeHtml(x.nombre)}">${escapeHtml(x.codigo)} - ${escapeHtml(x.nombre)}</option>`
  ).join("");
}

function exportarCuentasPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("PLAN DE CUENTAS - EXPORTADO", 20, 20);
  let y = 30;

  cargarCuentas()
    .sort((a, b) => compararCodigos(a.codigo, b.codigo))
    .forEach(c => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(`${c.codigo} - ${c.nombre}`, 20, y);
      y += 7;
    });

  doc.save("Plan_Cuentas.pdf");
}

// ====== 4. BALANCE INICIAL ======
function renderBalanceInicial() {
  let b = cargarDB("py_balance", []);
  b = b.filter(x => esCuentaAperturaValida(x.codigo));

  const body = byId("balanceBody");
  if (!body) return;

  body.innerHTML = b.map((x, i) =>
    `<tr><td>${i}</td><td>${escapeHtml(x.codigo)}</td><td>${escapeHtml(x.cuenta)}</td><td>${Number(x.saldo).toFixed(2)}</td></tr>`
  ).join("") || `<tr><td colspan="4">Sin saldos iniciales</td></tr>`;

  let tA = 0, tP = 0, tC = 0;

  b.forEach(x => {
    const saldo = Number(x.saldo) || 0;
    if (x.codigo.startsWith("1")) tA += saldo;
    else if (x.codigo.startsWith("2")) tP += saldo;
    else if (x.codigo.startsWith("3")) tC += saldo;
  });

  if (byId("totActivo")) byId("totActivo").textContent = `Bs ${tA.toFixed(2)}`;
  if (byId("totPasivo")) byId("totPasivo").textContent = `Bs ${tP.toFixed(2)}`;
  if (byId("totCapital")) byId("totCapital").textContent = `Bs ${tC.toFixed(2)}`;

  const m = byId("mensaje_ecuacion_contable");
  if (!m) return;

  if (Math.abs(tA - (tP + tC)) < 0.01 && tA > 0) {
    m.style.color = "green";
    m.innerHTML = `La ecuación contable se cumple: Activo = Pasivo + Capital = ${tA.toFixed(2)}`;
  } else if (tA > 0 || tP > 0 || tC > 0) {
    m.style.color = "red";
    m.innerHTML = `La ecuación contable no se cumple: Activo = ${tA.toFixed(2)}, Pasivo + Capital = ${(tP + tC).toFixed(2)}`;
  } else {
    m.style.color = "gray";
    m.innerHTML = "Sin datos de apertura.";
  }
}

function agregarSaldoInicial() {
  const select = byId("selectCuentaBalance");
  const inputMonto = byId("montoBalance");
  if (!select || !inputMonto) return;

  const sel = select.value;
  const monto = parseFloat(inputMonto.value);

  if (!sel || isNaN(monto) || monto <= 0) {
    return alert("Ingrese una cuenta y un monto válido.");
  }

  const [codigo, nombre] = sel.split("|");
  if (!esCuentaAperturaValida(codigo)) {
    return alert("Solo se admiten cuentas operativas de Activo, Pasivo y Patrimonio en el asiento de apertura.");
  }

  const b = cargarDB("py_balance", []);
  const existente = b.find(x => x.codigo === codigo);

  if (existente) {
    existente.saldo = (Number(existente.saldo) || 0) + monto;
  } else {
    b.push({ codigo, cuenta: nombre, saldo: monto });
  }

  guardarDB("py_balance", b);
  inputMonto.value = "";
  recalcularTodo();
}

function eliminarSaldoInput() {
  const idx = parseInt(byId("balance_eliminar").value);
  const b = cargarDB("py_balance", []);
  if (isNaN(idx) || idx < 0 || idx >= b.length) return alert("Índice inválido.");

  b.splice(idx, 1);
  guardarDB("py_balance", b);
  byId("balance_eliminar").value = "";
  recalcularTodo();
}

// ====== 5. LIBRO DIARIO ======
function renderLibroDiarioSinTotales() {
  const d = cargarDB("py_diario", []);
  const body = byId("libroDiarioBody");
  if (!body) return;

  body.innerHTML = d.map((x, i) =>
    `<tr>
      <td>${i}</td>
      <td>${escapeHtml(x.fecha)}</td>
      <td>${escapeHtml(x.codigo)}</td>
      <td>${escapeHtml(x.cuenta)}</td>
      <td>${escapeHtml(x.folio || "")}</td>
      <td>${Number(x.debe).toFixed(2)}</td>
      <td>${Number(x.haber).toFixed(2)}</td>
      <td>${escapeHtml(x.detalle || "")}</td>
    </tr>`
  ).join("") || `<tr><td colspan="8">Sin registros</td></tr>`;

  const container = byId("diarioTotalesContainer");
  if (container) container.style.display = "none";
}

function guardarAsientoConIVA() {
  const f = byId("asientoFecha").value;
  const sel = byId("asientoCuenta").value;
  const fol = byId("asientoFolio").value.trim();
  const d = parseFloat(byId("asientoDebe").value) || 0;
  const h = parseFloat(byId("asientoHaber").value) || 0;
  const det = byId("asientoDetalle").value.trim();

  const base = parseFloat(byId("asientoBase").value) || 0;
  let iva = parseFloat(byId("asientoIVA").value) || 0;
  const tipoIVA = byId("asientoTipoIVA").value;

  if (!f || !sel) return alert("Faltan datos.");
  if (!fol) return alert("Debes ingresar el folio o número de asiento.");
  if (d < 0 || h < 0) return alert("Debe y Haber no pueden ser negativos.");
  if ((d > 0 && h > 0) || (d === 0 && h === 0)) {
    return alert("En cada registro solo debes ingresar valor en Debe o en Haber.");
  }

  const [cod, nom] = sel.split("|");
  if (!esCuentaMovimientoValida(cod)) {
    return alert("Solo se permiten cuentas operativas en el diario.");
  }

  const diario = cargarDB("py_diario", []);
  const otroMismoFolio = diario.find(x => String(x.folio).trim() === fol);

  if (otroMismoFolio && otroMismoFolio.fecha !== f) {
    return alert("Un mismo folio no debe mezclar fechas distintas.");
  }

  diario.push({
    fecha: f,
    codigo: cod,
    cuenta: nom,
    folio: fol,
    debe: d,
    haber: h,
    detalle: det
  });

  if (tipoIVA) {
    if (base <= 0) return alert("Si usarás IVA, la base imponible debe ser mayor a 0.");
    if (iva <= 0) iva = calcularIVA(base);

    const cuentaIVA = obtenerCuentaIVA(tipoIVA);
    if (!cuentaIVA) return alert("No existe la cuenta contable de IVA en el plan de cuentas.");

    if (tipoIVA === "credito") {
      diario.push({
        fecha: f,
        codigo: cuentaIVA.codigo,
        cuenta: cuentaIVA.nombre,
        folio: fol,
        debe: iva,
        haber: 0,
        detalle: det || "Registro de Crédito Fiscal IVA"
      });
    }

    if (tipoIVA === "debito") {
      diario.push({
        fecha: f,
        codigo: cuentaIVA.codigo,
        cuenta: cuentaIVA.nombre,
        folio: fol,
        debe: 0,
        haber: iva,
        detalle: det || "Registro de Débito Fiscal IVA"
      });
    }
  }

  guardarDB("py_diario", diario);

  byId("asientoDebe").value = "0.00";
  byId("asientoHaber").value = "0.00";
  byId("asientoDetalle").value = "";
  byId("asientoBase").value = "0.00";
  byId("asientoIVA").value = "0.00";
  byId("asientoTipoIVA").value = "";

  recalcularTodo();
}

function eliminarAsientoInput() {
  const idx = parseInt(byId("asiento_eliminar").value);
  const d = cargarDB("py_diario", []);
  if (isNaN(idx) || idx < 0 || idx >= d.length) return alert("ID no existe.");

  d.splice(idx, 1);
  guardarDB("py_diario", d);
  byId("asiento_eliminar").value = "";
  recalcularTodo();
  alert("Asiento eliminado.");
}

function verificarTotalesDiario() {
  const resumen = resumirCuadreDiario();
  const d = cargarDB("py_diario", []);

  const container = byId("diarioTotalesContainer");
  if (container) container.style.display = "block";
  if (byId("totLibroDebe")) byId("totLibroDebe").textContent = `Bs ${resumen.totalDebe.toFixed(2)}`;
  if (byId("totLibroHaber")) byId("totLibroHaber").textContent = `Bs ${resumen.totalHaber.toFixed(2)}`;

  const body = byId("cuadrePorFolioBody");
  if (body) {
    const filas = Object.keys(resumen.porFolio).sort(compararCodigos).map(folio => {
      const debe = resumen.porFolio[folio].debe;
      const haber = resumen.porFolio[folio].haber;
      const ok = Math.abs(debe - haber) < 0.01;

      return `
        <tr>
          <td>${escapeHtml(folio)}</td>
          <td>${debe.toFixed(2)}</td>
          <td>${haber.toFixed(2)}</td>
          <td style="color:${ok ? 'green' : 'red'}; font-weight:900;">${ok ? 'CUADRADO' : 'NO CUADRA'}</td>
        </tr>
      `;
    }).join("");

    body.innerHTML = filas || `<tr><td colspan="4">Sin datos</td></tr>`;
  }

  const m = byId("estadoCuadreLibro");
  if (!m) return;

  if (d.length === 0) {
    m.style.color = "gray";
    m.innerHTML = "Sin datos.";
  } else if (resumen.diarioCuadrado) {
    m.style.color = "green";
    m.innerHTML = "El Libro Diario cuadra correctamente por asiento y en total general.";
  } else if (Math.abs(resumen.totalDebe - resumen.totalHaber) < 0.01) {
    m.style.color = "orange";
    m.innerHTML = "El total general cuadra, pero existen folios individuales que no cuadran.";
  } else {
    m.style.color = "red";
    m.innerHTML = "Los montos no cuadran. Revise los asientos.";
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
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    doc.text(`${x.fecha} | ${x.cuenta} | D:${Number(x.debe).toFixed(2)} | H:${Number(x.haber).toFixed(2)}`, 20, y);
    y += 7;
  });

  doc.save("Libro_Diario.pdf");
}

// ====== 6. LIBRO MAYOR ======
function renderSelectMayor() {
  const d = obtenerTodosLosMovimientos();
  const unicas = [];
  const vistos = new Set();

  d.forEach(x => {
    if (!vistos.has(x.codigo)) {
      vistos.add(x.codigo);
      unicas.push({ codigo: x.codigo, cuenta: x.cuenta });
    }
  });

  const select = byId("selectMayorCuenta");
  if (!select) return;

  select.innerHTML =
    `<option value="">Seleccione...</option>` +
    unicas
      .sort((a, b) => compararCodigos(a.codigo, b.codigo))
      .map(x => `<option value="${escapeHtml(x.codigo)}">${escapeHtml(x.codigo)} - ${escapeHtml(x.cuenta)}</option>`)
      .join("");

  const body = byId("mayorCuentaBody");
  if (body) body.innerHTML = "";
}

function renderMayorPorCuenta() {
  const select = byId("selectMayorCuenta");
  const body = byId("mayorCuentaBody");
  if (!select || !body) return;

  const codigoSel = select.value;
  if (!codigoSel) {
    body.innerHTML = "";
    return;
  }

  const movs = obtenerTodosLosMovimientos().filter(x => x.codigo === codigoSel);
  if (movs.length === 0) {
    body.innerHTML = "";
    return;
  }

  const nat = determinarNaturaleza(codigoSel);
  let saldo = 0;

  body.innerHTML = movs.map(m => {
    if (nat === "deudora") saldo += (Number(m.debe) || 0) - (Number(m.haber) || 0);
    else saldo += (Number(m.haber) || 0) - (Number(m.debe) || 0);

    return `
      <tr>
        <td>${escapeHtml(m.fecha)}</td>
        <td>${escapeHtml(m.folio || "")}</td>
        <td>${escapeHtml(m.detalle || "")}</td>
        <td>${Number(m.debe).toFixed(2)}</td>
        <td>${Number(m.haber).toFixed(2)}</td>
        <td><strong>${saldo.toFixed(2)}</strong></td>
      </tr>
    `;
  }).join("");
}

function renderBalanzaComprobacion() {
  const r = agruparSaldosPorCuenta();
  const arr = Object.keys(r)
    .map(k => ({ codigo: k, ...r[k] }))
    .sort((a, b) => compararCodigos(a.codigo, b.codigo));

  let tD = 0, tH = 0, tSD = 0, tSA = 0;
  const body = byId("balanzaBody");
  if (!body) return;

  body.innerHTML = arr.map(x => {
    tD += x.debe;
    tH += x.haber;

    let sDeudor = 0;
    let sAcreedor = 0;

    if (x.nat === "deudora") {
      sDeudor = x.debe - x.haber;
      if (sDeudor < 0) {
        sAcreedor = Math.abs(sDeudor);
        sDeudor = 0;
      }
    } else {
      sAcreedor = x.haber - x.debe;
      if (sAcreedor < 0) {
        sDeudor = Math.abs(sAcreedor);
        sAcreedor = 0;
      }
    }

    tSD += sDeudor;
    tSA += sAcreedor;

    return `
      <tr>
        <td>${escapeHtml(x.codigo)}</td>
        <td>${escapeHtml(x.cuenta)}</td>
        <td>${x.debe.toFixed(2)}</td>
        <td>${x.haber.toFixed(2)}</td>
        <td>${sDeudor.toFixed(2)}</td>
        <td>${sAcreedor.toFixed(2)}</td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="6">Sin datos</td></tr>`;

  if (byId("totSumasDebe")) byId("totSumasDebe").textContent = `Bs ${tD.toFixed(2)}`;
  if (byId("totSumasHaber")) byId("totSumasHaber").textContent = `Bs ${tH.toFixed(2)}`;
  if (byId("totSaldosDeudor")) byId("totSaldosDeudor").textContent = `Bs ${tSD.toFixed(2)}`;
  if (byId("totSaldosAcreedor")) byId("totSaldosAcreedor").textContent = `Bs ${tSA.toFixed(2)}`;

  const balanzaContainer = byId("balanzaContainer");
  if (balanzaContainer) balanzaContainer.style.display = "block";

  const m = byId("mensaje_balanza_cuadre");
  if (!m) return;

  if (Math.abs(tD - tH) < 0.01 && Math.abs(tSD - tSA) < 0.01 && tD > 0) {
    m.style.color = "green";
    m.innerHTML = "La Balanza de Sumas y Saldos está perfectamente cuadrada.";
  } else if (tD === 0 && tH === 0) {
    m.style.color = "gray";
    m.innerHTML = "Esperando movimientos.";
  } else {
    m.style.color = "red";
    m.innerHTML = "La Balanza no cuadra. Revise los movimientos del Diario o los ajustes.";
  }
}

// ====== 7. HOJA DE TRABAJO Y AJUSTES ======
function renderHojaTrabajo() {
  const body = byId("hojaTrabajoBody");
  if (!body) return;

  const r = agruparSaldosPorCuenta();

  const arr = Object.keys(r)
    .map(k => {
      let saldo = 0;
      if (r[k].nat === "deudora") saldo = r[k].debe - r[k].haber;
      else saldo = r[k].haber - r[k].debe;

      return { codigo: k, cuenta: r[k].cuenta, saldo };
    })
    .sort((a, b) => compararCodigos(a.codigo, b.codigo));

  body.innerHTML = arr.map(x =>
    `<tr><td>${escapeHtml(x.codigo)}</td><td>${escapeHtml(x.cuenta)}</td><td>${x.saldo.toFixed(2)}</td></tr>`
  ).join("") || `<tr><td colspan="3">Sin datos</td></tr>`;
}

function renderAjustes() {
  const body = byId("ajustesBody");
  if (!body) return;

  const ajustes = cargarAjustes();

  body.innerHTML = ajustes.map((a, i) => `
    <tr>
      <td>${i}</td>
      <td>${escapeHtml(a.fecha)}</td>
      <td>${escapeHtml(a.folio)}</td>
      <td>${escapeHtml(a.codigoDebe)} - ${escapeHtml(a.cuentaDebe)}</td>
      <td>${escapeHtml(a.codigoHaber)} - ${escapeHtml(a.cuentaHaber)}</td>
      <td>${Number(a.monto).toFixed(2)}</td>
      <td>${escapeHtml(a.detalle || "")}</td>
    </tr>
  `).join("") || `<tr><td colspan="7">Sin ajustes</td></tr>`;
}

function aplicarAjuste() {
  const fecha = byId("ajusteFecha").value;
  const folio = byId("ajusteFolio").value.trim();
  const selDebe = byId("ajusteCuentaDebe").value;
  const selHaber = byId("ajusteCuentaHaber").value;
  const monto = parseFloat(byId("ajusteMonto").value);
  const detalle = byId("ajusteDetalle").value.trim();

  if (!fecha || !folio || !selDebe || !selHaber || isNaN(monto) || monto <= 0) {
    return alert("Completa fecha, folio, cuentas y monto válidos.");
  }

  const [codigoDebe, cuentaDebe] = selDebe.split("|");
  const [codigoHaber, cuentaHaber] = selHaber.split("|");

  if (!esCuentaMovimientoValida(codigoDebe) || !esCuentaMovimientoValida(codigoHaber)) {
    return alert("Las cuentas del ajuste deben ser operativas.");
  }

  if (codigoDebe === codigoHaber) {
    return alert("La cuenta Debe y la cuenta Haber no pueden ser la misma.");
  }

  const ajustes = cargarAjustes();

  ajustes.push({
    fecha,
    folio,
    codigoDebe,
    cuentaDebe,
    codigoHaber,
    cuentaHaber,
    monto,
    detalle
  });

  guardarDB("py_ajustes", ajustes);

  byId("ajusteFecha").value = "";
  byId("ajusteFolio").value = "";
  byId("ajusteMonto").value = "";
  byId("ajusteDetalle").value = "";

  recalcularTodo();
}

function exportarHojaPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("HOJA DE TRABAJO", 20, 20);
  doc.save("Hoja_Trabajo.pdf");
}

// ====== 7.5 ESTADO DE RESULTADOS ======
function renderEstadoResultados() {
  const container = byId("estadoResultadosContainer");
  const msg = byId("estadoResultadosMensaje");
  if (!container || !msg) return;

  if (!puedeGenerarEstadosFinancieros()) {
    container.style.display = "none";
    msg.style.display = "block";
    msg.style.color = "red";
    msg.innerHTML = "No se puede generar el Estado de Resultados porque existen folios del Diario que no cuadran.";
    return;
  }

  msg.style.display = "none";

  const r = agruparSaldosPorCuenta();

  let htmlI = "", htmlC = "", htmlG = "";
  let tI = 0, tC = 0, tG = 0;

  Object.keys(r).sort(compararCodigos).forEach(k => {
    let saldo = 0;
    if (r[k].nat === "deudora") saldo = r[k].debe - r[k].haber;
    else saldo = r[k].haber - r[k].debe;

    if (k.startsWith("4") && saldo !== 0) {
      tI += saldo;
      htmlI += `<tr><td>${escapeHtml(r[k].cuenta)}</td><td>${saldo.toFixed(2)}</td></tr>`;
    }
    if (k.startsWith("6") && saldo !== 0) {
      tC += saldo;
      htmlC += `<tr><td>${escapeHtml(r[k].cuenta)}</td><td>${saldo.toFixed(2)}</td></tr>`;
    }
    if (k.startsWith("5") && saldo !== 0) {
      tG += saldo;
      htmlG += `<tr><td>${escapeHtml(r[k].cuenta)}</td><td>${saldo.toFixed(2)}</td></tr>`;
    }
  });

  if (byId("erIngresosBody")) byId("erIngresosBody").innerHTML = htmlI || `<tr><td colspan="2">Sin ingresos</td></tr>`;
  if (byId("erCostosBody")) byId("erCostosBody").innerHTML = htmlC || `<tr><td colspan="2">Sin costos</td></tr>`;
  if (byId("erGastosBody")) byId("erGastosBody").innerHTML = htmlG || `<tr><td colspan="2">Sin gastos</td></tr>`;

  const utilidadBruta = tI - tC;
  const utilidadNeta = utilidadBruta - tG;

  if (byId("erUtilidadBruta")) byId("erUtilidadBruta").textContent = `Bs ${utilidadBruta.toFixed(2)}`;

  const utilNetaEl = byId("erUtilidadNeta");
  if (utilNetaEl) {
    utilNetaEl.textContent = `Bs ${utilidadNeta.toFixed(2)}`;
    const titleNode = utilNetaEl.parentElement ? utilNetaEl.parentElement.querySelector("h3") : null;

    if (utilidadNeta < 0) {
      utilNetaEl.style.color = "#c62828";
      if (titleNode) titleNode.textContent = "PÉRDIDA NETA DEL EJERCICIO";
    } else {
      utilNetaEl.style.color = "var(--sidebar-color)";
      if (titleNode) titleNode.textContent = "UTILIDAD NETA DEL EJERCICIO";
    }
  }

  container.style.display = "block";
}

// ====== 8. BALANCE GENERAL ======
function renderBalanceGeneral() {
  const container = byId("balanceGeneralContainer");
  const aviso = byId("balanceGeneralMensaje");
  if (!container || !aviso) return;

  if (!puedeGenerarEstadosFinancieros()) {
    container.style.display = "none";
    aviso.style.display = "block";
    aviso.style.color = "red";
    aviso.innerHTML = "No se puede generar el Balance General porque existen folios del Diario que no cuadran.";
    return;
  }

  aviso.style.display = "none";

  const r = agruparSaldosPorCuenta();

  let tA = 0, tP = 0, tPat = 0, tI = 0, tCostosYGastos = 0;
  let htmlA = "", htmlP = "", htmlC = "";

  Object.keys(r).sort(compararCodigos).forEach(k => {
    let saldo = 0;
    if (r[k].nat === "deudora") saldo = r[k].debe - r[k].haber;
    else saldo = r[k].haber - r[k].debe;

    if (k.startsWith("1") && saldo !== 0) {
      tA += saldo;
      htmlA += `<tr><td>${escapeHtml(r[k].cuenta)}</td><td>${saldo.toFixed(2)}</td></tr>`;
    }

    if (k.startsWith("2") && saldo !== 0) {
      tP += saldo;
      htmlP += `<tr><td>${escapeHtml(r[k].cuenta)}</td><td>${saldo.toFixed(2)}</td></tr>`;
    }

    if (k.startsWith("3") && saldo !== 0) {
      tPat += saldo;
      htmlC += `<tr><td>${escapeHtml(r[k].cuenta)}</td><td>${saldo.toFixed(2)}</td></tr>`;
    }

    if (k.startsWith("4")) tI += saldo;
    if (k.startsWith("5") || k.startsWith("6")) tCostosYGastos += saldo;
  });

  const resultadoPeriodo = tI - tCostosYGastos;
  tPat += resultadoPeriodo;
  htmlC += `<tr><td><strong>Resultado del Período</strong></td><td><strong>${resultadoPeriodo.toFixed(2)}</strong></td></tr>`;

  if (byId("bgActivosBody")) byId("bgActivosBody").innerHTML = htmlA || `<tr><td colspan="2">Sin cuentas de activo</td></tr>`;
  if (byId("bgPasivosBody")) byId("bgPasivosBody").innerHTML = htmlP || `<tr><td colspan="2">Sin cuentas de pasivo</td></tr>`;
  if (byId("bgPatrimonioBody")) byId("bgPatrimonioBody").innerHTML = htmlC || `<tr><td colspan="2">Sin patrimonio</td></tr>`;

  if (byId("bgTotActivo")) byId("bgTotActivo").textContent = `Bs ${tA.toFixed(2)}`;
  if (byId("bgTotPasPat")) byId("bgTotPasPat").textContent = `Bs ${(tP + tPat).toFixed(2)}`;
  container.style.display = "block";

  const m = byId("mensaje_balance_cuadre");
  if (!m) return;

  if (Math.abs(tA - (tP + tPat)) < 0.01 && tA > 0) {
    m.style.color = "green";
    m.innerHTML = "El Balance General está perfectamente cuadrado.";
  } else if (tA === 0 && tP === 0 && tPat === 0) {
    m.style.color = "gray";
    m.innerHTML = "Esperando cálculos.";
  } else {
    m.style.color = "red";
    m.innerHTML = `El Balance no cuadra. Diferencia: ${Math.abs(tA - (tP + tPat)).toFixed(2)}`;
  }
}

function obtenerPorcentajeIVA() {
  const config = cargarConfiguracion();
  return Number(config.ivaPorcentaje || 13);
}

function calcularIVA(base) {
  const porcentaje = obtenerPorcentajeIVA();
  return (Number(base) || 0) * porcentaje / 100;
}

function buscarCuentaPorNombreExacto(nombre) {
  return cargarCuentas().find(c => c.nombre === nombre);
}

function obtenerCuentaIVA(tipo) {
  if (tipo === "credito") {
    return buscarCuentaPorNombreExacto("Crédito Fiscal IVA");
  }
  if (tipo === "debito") {
    return buscarCuentaPorNombreExacto("Débito Fiscal IVA");
  }
  return null;
}

function exportarBalancePDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("BALANCE GENERAL", 20, 20);
  doc.save("Balance_General.pdf");
}

// ====== 9. INVENTARIO ======
function cargarInvProductos() {
  return cargarDB("py_inv_prod", [
    { codigo: "PROD1", nombre: "Harina Mágica", categoria: "Materia Prima", stock: 100 }
  ]);
}

function cargarInvMovimientos() {
  return cargarDB("py_inv_movs", []);
}

function guardarInvProductos(data) {
  guardarDB("py_inv_prod", data);
}

function guardarInvMovimientos(data) {
  guardarDB("py_inv_movs", data);
}

function renderInventario() {
  const productos = cargarInvProductos();
  const movimientos = cargarInvMovimientos();

  const invProducto = byId("invProducto");
  const invEditarSelect = byId("invEditarSelect");
  const invEliminarSelect = byId("invEliminarSelect");
  const invStockBody = byId("invStockBody");
  const invMovsBody = byId("invMovsBody");

  if (invProducto) {
    invProducto.innerHTML = productos.length
      ? productos.map(x => `<option value="${escapeHtml(x.codigo)}">${escapeHtml(x.codigo)} - ${escapeHtml(x.nombre)}</option>`).join("")
      : `<option value="">Sin productos</option>`;
  }

  if (invEditarSelect) {
    invEditarSelect.innerHTML = productos.length
      ? `<option value="">Seleccione un producto...</option>` +
        productos.map(x => `<option value="${escapeHtml(x.codigo)}">${escapeHtml(x.codigo)} - ${escapeHtml(x.nombre)}</option>`).join("")
      : `<option value="">Sin productos</option>`;
  }

  if (invEliminarSelect) {
    invEliminarSelect.innerHTML = productos.length
      ? productos.map(x => `<option value="${escapeHtml(x.codigo)}">${escapeHtml(x.codigo)} - ${escapeHtml(x.nombre)}</option>`).join("")
      : `<option value="">Sin productos</option>`;
  }

  if (invStockBody) {
    invStockBody.innerHTML = productos.length
      ? productos.map(x => `
          <tr>
            <td>${escapeHtml(x.codigo)}</td>
            <td>${escapeHtml(x.nombre)}</td>
            <td>${escapeHtml(x.categoria)}</td>
            <td>${Number(x.stock)}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="4">No hay productos registrados.</td></tr>`;
  }

  if (invMovsBody) {
    invMovsBody.innerHTML = movimientos.length
      ? movimientos.map(x => `
          <tr>
            <td>${escapeHtml(x.fecha)}</td>
            <td>${escapeHtml(x.producto)}</td>
            <td>${Number(x.entrada)}</td>
            <td>${Number(x.salida)}</td>
            <td>${Number(x.montoBase || 0).toFixed(2)}</td>
            <td>${Number(x.iva || 0).toFixed(2)}</td>
            <td>${escapeHtml(x.detalle || "")}</td>
            <td>${escapeHtml(x.folio || "")}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="8">No hay movimientos registrados.</td></tr>`;
  }
}

function limpiarFormularioProducto() {
  if (byId("invNuevoCodigo")) byId("invNuevoCodigo").value = "";
  if (byId("invNuevoNombre")) byId("invNuevoNombre").value = "";
  if (byId("invNuevaCategoria")) byId("invNuevaCategoria").value = "";
  if (byId("invNuevoStock")) byId("invNuevoStock").value = "";
}

function limpiarFormularioEditarProducto() {
  if (byId("invEditarCodigo")) byId("invEditarCodigo").value = "";
  if (byId("invEditarNombre")) byId("invEditarNombre").value = "";
  if (byId("invEditarCategoria")) byId("invEditarCategoria").value = "";
  if (byId("invEditarStock")) byId("invEditarStock").value = "";
}

function agregarProducto() {
  const codigo = byId("invNuevoCodigo").value.trim();
  const nombre = byId("invNuevoNombre").value.trim();
  const categoria = byId("invNuevaCategoria").value.trim();
  const stock = parseInt(byId("invNuevoStock").value);

  if (!codigo || !nombre || !categoria || isNaN(stock) || stock < 0) {
    return alert("Completa correctamente código, nombre, categoría y stock inicial.");
  }

  const productos = cargarInvProductos();
  const existeCodigo = productos.some(p => p.codigo.toLowerCase() === codigo.toLowerCase());
  if (existeCodigo) return alert("Ya existe un producto con ese código.");

  productos.push({ codigo, nombre, categoria, stock });
  guardarInvProductos(productos);
  limpiarFormularioProducto();
  renderInventario();
  alert("Producto agregado correctamente.");
}

function cargarProductoParaEditar() {
  const codigo = byId("invEditarSelect").value;
  const productos = cargarInvProductos();
  const prod = productos.find(p => p.codigo === codigo);

  if (!prod) {
    limpiarFormularioEditarProducto();
    return;
  }

  byId("invEditarCodigo").value = prod.codigo;
  byId("invEditarNombre").value = prod.nombre;
  byId("invEditarCategoria").value = prod.categoria;
  byId("invEditarStock").value = prod.stock;
}

function editarProducto() {
  const codigoOriginal = byId("invEditarSelect").value;
  const nuevoCodigo = byId("invEditarCodigo").value.trim();
  const nuevoNombre = byId("invEditarNombre").value.trim();
  const nuevaCategoria = byId("invEditarCategoria").value.trim();
  const nuevoStock = parseInt(byId("invEditarStock").value);

  if (!codigoOriginal) return alert("Selecciona primero un producto para editar.");
  if (!nuevoCodigo || !nuevoNombre || !nuevaCategoria || isNaN(nuevoStock) || nuevoStock < 0) {
    return alert("Completa correctamente los datos del producto.");
  }

  const productos = cargarInvProductos();
  const idx = productos.findIndex(p => p.codigo === codigoOriginal);
  if (idx === -1) return alert("Producto no encontrado.");

  const duplicado = productos.some((p, i) => i !== idx && p.codigo.toLowerCase() === nuevoCodigo.toLowerCase());
  if (duplicado) return alert("Ya existe otro producto con ese código.");

  const codigoAnterior = productos[idx].codigo;
  const nombreAnterior = productos[idx].nombre;

  productos[idx] = {
    codigo: nuevoCodigo,
    nombre: nuevoNombre,
    categoria: nuevaCategoria,
    stock: nuevoStock
  };

  guardarInvProductos(productos);

  const movimientos = cargarInvMovimientos().map(m => {
    if (m.codigoProducto === codigoAnterior) {
      return { ...m, codigoProducto: nuevoCodigo, producto: nuevoNombre };
    }
    if (m.producto === nombreAnterior && !m.codigoProducto) {
      return { ...m, producto: nuevoNombre };
    }
    return m;
  });

  guardarInvMovimientos(movimientos);
  renderInventario();
  byId("invEditarSelect").value = nuevoCodigo;
  cargarProductoParaEditar();
  alert("Producto editado correctamente.");
}

function eliminarProducto() {
  const codigo = byId("invEliminarSelect").value;
  if (!codigo) return alert("Selecciona un producto.");

  const productos = cargarInvProductos();
  const prod = productos.find(p => p.codigo === codigo);
  if (!prod) return alert("Producto no encontrado.");

  const movimientos = cargarInvMovimientos();
  const tieneMovimientos = movimientos.some(m => m.codigoProducto === codigo || m.producto === prod.nombre);
  if (tieneMovimientos) return alert("No puedes eliminar este producto porque ya tiene movimientos registrados.");

  guardarInvProductos(productos.filter(p => p.codigo !== codigo));
  renderInventario();
  limpiarFormularioEditarProducto();
  alert("Producto eliminado correctamente.");
}

function registrarMovimiento() {
  const fecha = byId("invFechaMov").value;
  const folio = byId("invFolioMov").value.trim();
  const codigoProd = byId("invProducto").value;
  const tipo = byId("invTipoMov").value;
  const cant = parseInt(byId("invCantidad").value);
  const costoUnitario = parseFloat(byId("invCostoUnitario").value);
  const det = byId("invDetalle").value.trim();
  const selInv = byId("invCuentaInventario").value;
  const selContra = byId("invCuentaContra").value;
  const tipoIVA = byId("invTipoIVA").value;

  if (!fecha || !folio) return alert("Debes ingresar fecha y folio contable.");
  if (!codigoProd || isNaN(cant) || cant <= 0) return alert("Ingrese datos válidos.");
  if (isNaN(costoUnitario) || costoUnitario < 0) return alert("Debes ingresar costo o precio unitario válido.");
  if (!selInv || !selContra) return alert("Debes seleccionar las cuentas contables del movimiento.");

  const [codInv, nomInv] = selInv.split("|");
  const [codContra, nomContra] = selContra.split("|");

  if (!esCuentaActivo(codInv)) return alert("La cuenta de inventario debe ser una cuenta operativa de activo.");
  if (!esCuentaMovimientoValida(codContra)) return alert("La cuenta contrapartida debe ser una cuenta operativa.");
  if (codInv === codContra) return alert("La cuenta de inventario y la contrapartida no pueden ser iguales.");

  const productos = cargarInvProductos();
  const idx = productos.findIndex(x => x.codigo === codigoProd);
  if (idx === -1) return alert("Producto no encontrado.");

  let e = 0;
  let s = 0;

  if (tipo === "Entrada") {
    productos[idx].stock += cant;
    e = cant;
  } else {
    if (cant > productos[idx].stock) return alert("No hay stock suficiente.");
    productos[idx].stock -= cant;
    s = cant;
  }

  const montoBase = cant * costoUnitario;
  const montoIVA = tipoIVA ? calcularIVA(montoBase) : 0;
  const cuentaIVA = tipoIVA ? obtenerCuentaIVA(tipoIVA) : null;

  if (tipoIVA && !cuentaIVA) {
    return alert("No existe la cuenta contable de IVA en el plan de cuentas.");
  }

  const movimientos = cargarInvMovimientos();
  movimientos.push({
    fecha,
    folio,
    codigoProducto: productos[idx].codigo,
    producto: productos[idx].nombre,
    entrada: e,
    salida: s,
    detalle: det,
    cantidad: cant,
    costoUnitario,
    montoBase,
    iva: montoIVA,
    tipoIVA: tipoIVA || ""
  });

  const diario = cargarDB("py_diario", []);

  if (tipo === "Entrada") {
    diario.push({
      fecha,
      codigo: codInv,
      cuenta: nomInv,
      folio,
      debe: montoBase,
      haber: 0,
      detalle: det || `Entrada inventario ${productos[idx].nombre}`
    });

    if (tipoIVA === "credito") {
      diario.push({
        fecha,
        codigo: cuentaIVA.codigo,
        cuenta: cuentaIVA.nombre,
        folio,
        debe: montoIVA,
        haber: 0,
        detalle: det || `Crédito Fiscal IVA por compra de ${productos[idx].nombre}`
      });
    }

    diario.push({
      fecha,
      codigo: codContra,
      cuenta: nomContra,
      folio,
      debe: 0,
      haber: montoBase + (tipoIVA === "credito" ? montoIVA : 0),
      detalle: det || `Contrapartida entrada inventario ${productos[idx].nombre}`
    });
  } else {
    diario.push({
      fecha,
      codigo: codContra,
      cuenta: nomContra,
      folio,
      debe: montoBase,
      haber: 0,
      detalle: det || `Salida inventario ${productos[idx].nombre}`
    });

    diario.push({
      fecha,
      codigo: codInv,
      cuenta: nomInv,
      folio,
      debe: 0,
      haber: montoBase,
      detalle: det || `Baja inventario ${productos[idx].nombre}`
    });

    if (tipoIVA === "debito") {
      diario.push({
        fecha,
        codigo: cuentaIVA.codigo,
        cuenta: cuentaIVA.nombre,
        folio,
        debe: 0,
        haber: montoIVA,
        detalle: det || `Débito Fiscal IVA por salida/venta de ${productos[idx].nombre}`
      });
    }
  }

  guardarInvProductos(productos);
  guardarInvMovimientos(movimientos);
  guardarDB("py_diario", diario);

  byId("invFechaMov").value = "";
  byId("invFolioMov").value = "";
  byId("invCantidad").value = "1";
  byId("invCostoUnitario").value = "";
  byId("invDetalle").value = "";
  byId("invTipoIVA").value = "";

  recalcularTodo();
  alert("Movimiento registrado con éxito, con IVA implementado y asiento contable generado.");
}

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
function exportarBalanceInicialPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("BALANCE INICIAL", 20, 20);
  doc.save("Balance_Inicial.pdf");
}

function exportarMayorPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("LIBRO MAYOR", 20, 20);
  doc.save("Libro_Mayor.pdf");
}

function exportarEstadoResultadosPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("ESTADO DE RESULTADOS", 20, 20);
  doc.save("Estado_Resultados.pdf");
}
// ====== INICIO ======
window.addEventListener("DOMContentLoaded", () => {
  const sesion = JSON.parse(localStorage.getItem("py_session"));

  if (!sesion || !sesion.activa) {
    window.location.href = "login.html";
    return;
  }

  const headerUserName = byId("headerUserName");
  if (headerUserName) {
    headerUserName.textContent = `${sesion.usuario} - ${sesion.rol}`;
  }

  aplicarConfiguracionUI();
  showSection("usuarios", document.querySelector(".sidebar nav a"));
});
