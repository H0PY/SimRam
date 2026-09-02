const BLOCK_SIZE_MB = 500;
const COLUMNS = 16; 

const COLOR_MAP = {
  'Sistema Operativo': '#3b82f6',
  'Navegador': '#06b6d4',
  'Videojuego': '#ef4444',
  'Spotify': '#10b981',
  'Discord': '#8b5cf6',
  'Editor de texto': '#f59e0b',
  'Editor de video': '#ec4899'
};

// Variables de Estado Interno
let ramTotalMB = 16384;
let rows = 0;
let ramMatrix = []; // Matriz Bidimensional [Fila][Columna]
let activeProcesses = [];
let selectedCoord = null; // Guarda objeto {r, c}

document.addEventListener('DOMContentLoaded', () => {
  initRAM();

  document.getElementById('ram-select').addEventListener('change', (e) => {
    ramTotalMB = parseInt(e.target.value);
    initRAM();
  });

  document.getElementById('btn-reset').addEventListener('click', () => initRAM());
  document.getElementById('btn-open').addEventListener('click', handleOpenApp);
  document.getElementById('btn-write').addEventListener('click', handleWriteMemory);
});

function initRAM() {
  const totalBlocks = Math.floor(ramTotalMB / BLOCK_SIZE_MB);
  rows = Math.ceil(totalBlocks / COLUMNS);
  ramMatrix = [];

  let blockCounter = 0;
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < COLUMNS; c++) {
      if (blockCounter < totalBlocks) {
        const hexAddr = '0x' + (0x1000 + blockCounter * 4).toString(16).toUpperCase();
        row.push({
          address: hexAddr,
          owner: null,
          processId: null,
          data: {}
        });
        blockCounter++;
      } else {
        row.push(null); // Relleno si no completa una celda física
      }
    }
    ramMatrix.push(row);
  }

  activeProcesses = [];
  selectedCoord = null;
  logHistory(`Simulación iniciada. RAM: ${ramTotalMB / 1024} GB (${totalBlocks} bloques en Matriz ${rows}x${COLUMNS}).`);
  renderAll();
}

// Recorrido de Matriz tipo First-Fit buscando bloques contiguos en la retícula
function handleOpenApp() {
  const select = document.getElementById('app-select');
  const appName = select.value;
  const sizeMB = parseInt(select.options[select.selectedIndex].dataset.size);
  const blocksNeeded = Math.ceil(sizeMB / BLOCK_SIZE_MB);

  let foundCoords = [];
  let currentSearch = [];

  // Recorrido secuencial por filas y columnas
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < COLUMNS; c++) {
      const block = ramMatrix[r][c];
      if (block && block.owner === null) {
        currentSearch.push({ r, c });
        if (currentSearch.length === blocksNeeded) {
          foundCoords = currentSearch;
          break;
        }
      } else {
        currentSearch = [];
      }
    }
    if (foundCoords.length === blocksNeeded) break;
  }

  // Si no se encuentra espacio suficiente
  if (foundCoords.length < blocksNeeded) {
    const freeMB = countFreeBlocks() * BLOCK_SIZE_MB;
    alert(`MEMORIA RAM INSUFICIENTE\n\nRequiere: ${sizeMB} MB\nDisponible: ${freeMB} MB\nNo es posible cargar el programa.`);
    logHistory(`ERROR: Espacio insuficiente para ${appName} (${sizeMB} MB).`);
    return;
  }

  // Asignar el proceso dentro de la matriz
  const processId = Date.now();
  const firstBlock = ramMatrix[foundCoords[0].r][foundCoords[0].c];

  activeProcesses.push({
    processId: processId,
    name: appName,
    sizeMB: sizeMB,
    initialAddr: firstBlock.address
  });

  foundCoords.forEach(({ r, c }, index) => {
    const b = ramMatrix[r][c];
    b.owner = appName;
    b.processId = processId;

    // Datos simulados por defecto
    if (appName === 'Battlefield 6') {
      if (index === 0) b.data = { clave: 'jugador', valor: 'Alex' };
      if (index === 1) b.data = { clave: 'vida', valor: '100' };
    }
  });

  logHistory(`Se cargó ${appName} (${sizeMB} MB) desde la dirección ${firstBlock.address}.`);
  renderAll();
}

// Liberar memoria liberando los bloques dentro de la Matriz
function closeProcess(processId) {
  const index = activeProcesses.findIndex(p => p.processId === processId);
  if (index === -1) return;

  const proc = activeProcesses[index];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < COLUMNS; c++) {
      const block = ramMatrix[r][c];
      if (block && block.processId === processId) {
        block.owner = null;
        block.processId = null;
        block.data = {};
      }
    }
  }

  activeProcesses.splice(index, 1);
  logHistory(`Se cerró ${proc.name}. Espacio liberado.`);
  selectedCoord = null;
  renderAll();
}

// Modificar datos en bloque
function handleWriteMemory() {
  if (!selectedCoord) return;
  const block = ramMatrix[selectedCoord.r][selectedCoord.c];
  
  if (!block || !block.owner) {
    alert("No se pueden editar bloques sin asignar.");
    return;
  }

  const k = document.getElementById('input-key').value;
  const v = document.getElementById('input-val').value;

  block.data = { clave: k, valor: v };
  logHistory(`Modificado [${block.address}]: ${k} = ${v}`);
  renderAll();
}

// Renderizado de la Interfaz
function renderAll() {
  renderMatrix();
  renderDashboard();
  renderProcessTable();
  renderDetailForm();
}

function renderMatrix() {
  const gridContainer = document.getElementById('ram-matrix-grid');
  gridContainer.innerHTML = '';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < COLUMNS; c++) {
      const block = ramMatrix[r][c];
      if (!block) continue;

      const div = document.createElement('div');
      div.className = 'cell';

      if (block.owner) {
        div.classList.add('occupied');
        div.style.backgroundColor = COLOR_MAP[block.owner] || '#4b5563';
        div.innerText = block.owner.substring(0, 3).toUpperCase();
      } else {
        div.innerText = block.address.replace('0x', '');
      }

      if (selectedCoord && selectedCoord.r === r && selectedCoord.c === c) {
        div.classList.add('selected');
      }

      div.addEventListener('click', () => {
        selectedCoord = { r, c };
        renderAll();
      });

      gridContainer.appendChild(div);
    }
  }
}

function countFreeBlocks() {
  let count = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < COLUMNS; c++) {
      if (ramMatrix[r][c] && ramMatrix[r][c].owner === null) count++;
    }
  }
  return count;
}

function renderDashboard() {
  const totalBlocks = Math.floor(ramTotalMB / BLOCK_SIZE_MB);
  const freeBlocks = countFreeBlocks();
  const usedBlocks = totalBlocks - freeBlocks;
  const usedMB = usedBlocks * BLOCK_SIZE_MB;
  const freeMB = ramTotalMB - usedMB;
  const percent = Math.round((usedMB / ramTotalMB) * 100);

  document.getElementById('lbl-total').innerText = `${ramTotalMB / 1024} GB`;
  document.getElementById('lbl-used').innerText = `${usedMB} MB`;
  document.getElementById('lbl-free').innerText = `${(freeMB / 1024).toFixed(1)} GB`;
  document.getElementById('lbl-percent').innerText = `${percent}%`;

  const bar = document.getElementById('progress-bar');
  bar.style.width = `${percent}%`;

  const badge = document.getElementById('status-badge');
  if (percent >= 90) {
    bar.style.backgroundColor = '#ef4444';
    badge.innerText = "● CRÍTICO";
    badge.style.color = "#ef4444";
  } else if (percent >= 70) {
    bar.style.backgroundColor = '#f59e0b';
    badge.innerText = "● ELEVADO";
    badge.style.color = "#f59e0b";
  } else {
    bar.style.backgroundColor = '#10b981';
    badge.innerText = "● NORMAL";
    badge.style.color = "#10b981";
  }
}

function renderProcessTable() {
  const tbody = document.getElementById('process-table-body');
  tbody.innerHTML = '';

  activeProcesses.forEach(proc => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${proc.name}</td>
      <td>${proc.initialAddr}</td>
      <td>${proc.sizeMB} MB</td>
      <td><button onclick="closeProcess(${proc.processId})" style="border-color:#ef4444; color:#fca5a5; background:transparent; padding:2px 6px;">CERRAR</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function renderDetailForm() {
  const detailBox = document.getElementById('block-details');
  const editForm = document.getElementById('edit-form');

  if (!selectedCoord) {
    detailBox.classList.remove('hidden');
    editForm.classList.add('hidden');
    return;
  }

  const block = ramMatrix[selectedCoord.r][selectedCoord.c];
  detailBox.classList.add('hidden');
  editForm.classList.remove('hidden');

  document.getElementById('detail-addr').innerText = block.address;
  document.getElementById('detail-owner').innerText = block.owner ? block.owner : "Libre";
  document.getElementById('input-key').value = block.data.clave || '';
  document.getElementById('input-val').value = block.data.valor || '';
}

function logHistory(msg) {
  const logBox = document.getElementById('history-log');
  const time = new Date().toLocaleTimeString();
  logBox.innerHTML += `[${time}] ${msg}<br>`;
  logBox.scrollTop = logBox.scrollHeight;
}