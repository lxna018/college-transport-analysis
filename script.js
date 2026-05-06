const sampleCsv = `route_name,stop_name,student_count,travel_time_min,distance_km,occupancy_percent,latitude,longitude
North Gate Route,North Gate,42,28,8.4,84,13.0827,80.2707
North Gate Route,Lake View Stop,39,31,9.1,78,13.0871,80.2631
North Gate Route,Market Junction,45,35,10.2,90,13.0914,80.2588
City Center Route,City Center,36,24,7.3,80,13.0604,80.2496
City Center Route,Main Signal,32,26,7.8,71,13.0649,80.2442
City Center Route,Bus Depot,29,30,8.9,64,13.0702,80.2395
Hostel Loop,Boys Hostel,28,14,3.8,70,13.0105,80.2217
Hostel Loop,Girls Hostel,31,16,4.1,78,13.0143,80.2244
Hostel Loop,Sports Block,18,19,5.0,45,13.0182,80.2281
Railway Route,Railway Station,34,38,12.4,68,13.0951,80.2764
Railway Route,Bridge Stop,26,42,13.8,52,13.1016,80.2813
Railway Route,Old Town,22,46,15.2,44,13.1084,80.2869
Library Link,Library Corner,14,12,2.9,40,13.0287,80.2365
Library Link,Research Block,11,15,3.4,31,13.0319,80.2397
Library Link,Admin Gate,17,18,4.2,49,13.0358,80.2429
South Extension,South Gate,21,33,11.3,47,12.9821,80.2194
South Extension,Tech Park Stop,24,36,12.1,53,12.9754,80.2141
South Extension,Outer Ring Road,19,41,14.0,42,12.9688,80.2087
Special Event Route,Auditorium Ground,52,22,6.8,104,13.0452,80.2524
Temporary Route,Remote Pickup,6,65,24.8,13,13.1425,80.3348`;

const state = {
  rows: [],
  headers: [],
  numericHeaders: [],
};

const colors = ["#2d6cdf", "#0f9f8f", "#f1a51f", "#6c5ce7", "#4f7f52", "#d94848", "#00a8cc", "#9b59b6"];

const elements = {
  csvFile: document.querySelector("#csvFile"),
  loadSampleBtn: document.querySelector("#loadSampleBtn"),
  analyzeBtn: document.querySelector("#analyzeBtn"),
  fileStatus: document.querySelector("#fileStatus"),
  helperText: document.querySelector("#helperText"),
  routeColumn: document.querySelector("#routeColumn"),
  stopColumn: document.querySelector("#stopColumn"),
  xColumn: document.querySelector("#xColumn"),
  yColumn: document.querySelector("#yColumn"),
  kInput: document.querySelector("#kInput"),
  epsInput: document.querySelector("#epsInput"),
  minPtsInput: document.querySelector("#minPtsInput"),
  rowCount: document.querySelector("#rowCount"),
  routeCount: document.querySelector("#routeCount"),
  dbscanClusters: document.querySelector("#dbscanClusters"),
  noiseCount: document.querySelector("#noiseCount"),
  modelStatus: document.querySelector("#modelStatus"),
  summaryText: document.querySelector("#summaryText"),
  previewTable: document.querySelector("#previewTable"),
  previewStatus: document.querySelector("#previewStatus"),
  dbscanCanvas: document.querySelector("#dbscanCanvas"),
  kmeansCanvas: document.querySelector("#kmeansCanvas"),
  routeCanvas: document.querySelector("#routeCanvas"),
};

elements.csvFile.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const text = await file.text();
  loadCsv(text, file.name);
});

elements.loadSampleBtn.addEventListener("click", () => {
  loadCsv(sampleCsv, "sample_transport_dataset.csv");
});

elements.analyzeBtn.addEventListener("click", analyzeDataset);

function loadCsv(text, fileName) {
  const parsed = parseCsv(text);
  if (parsed.length < 2) {
    setHelper("The CSV needs a header row and at least one data row.", true);
    return;
  }

  state.headers = parsed[0].map((header) => header.trim()).filter(Boolean);
  state.rows = parsed.slice(1)
    .filter((row) => row.some((cell) => String(cell).trim() !== ""))
    .map((row) => rowToObject(state.headers, row));
  state.numericHeaders = state.headers.filter((header) =>
    state.rows.some((row) => Number.isFinite(toNumber(row[header])))
  );

  if (state.rows.length === 0 || state.numericHeaders.length < 2) {
    setHelper("Use a CSV with at least two numeric columns for clustering.", true);
    return;
  }

  populateSelectors();
  elements.fileStatus.textContent = `${fileName} loaded`;
  elements.analyzeBtn.disabled = false;
  setHelper(`${state.rows.length} rows loaded. Choose columns, then analyze.`, false);
  renderPreview();
  analyzeDataset();
}

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows;
}

function rowToObject(headers, row) {
  return headers.reduce((record, header, index) => {
    record[header] = row[index] ?? "";
    return record;
  }, {});
}

function populateSelectors() {
  fillSelect(elements.routeColumn, state.headers, findHeader(["route_name", "route", "route_id"]));
  fillSelect(elements.stopColumn, state.headers, findHeader(["stop_name", "stop", "location"]));
  fillSelect(elements.xColumn, state.numericHeaders, findHeader(["distance_km", "distance", "latitude", "student_count"], true));
  fillSelect(elements.yColumn, state.numericHeaders, findHeader(["student_count", "occupancy_percent", "travel_time_min", "longitude"], true));

  if (elements.xColumn.value === elements.yColumn.value && state.numericHeaders.length > 1) {
    elements.yColumn.value = state.numericHeaders.find((header) => header !== elements.xColumn.value);
  }
}

function fillSelect(select, options, preferred) {
  select.innerHTML = "";
  options.forEach((option) => {
    const item = document.createElement("option");
    item.value = option;
    item.textContent = option;
    select.appendChild(item);
  });
  if (preferred && options.includes(preferred)) select.value = preferred;
}

function findHeader(candidates, numericOnly = false) {
  const source = numericOnly ? state.numericHeaders : state.headers;
  return source.find((header) => candidates.includes(header.toLowerCase())) || source[0];
}

function analyzeDataset() {
  const xColumn = elements.xColumn.value;
  const yColumn = elements.yColumn.value;

  if (!xColumn || !yColumn || xColumn === yColumn) {
    setHelper("Choose two different numeric columns for the graph.", true);
    return;
  }

  const points = state.rows
    .map((row, index) => ({
      index,
      row,
      x: toNumber(row[xColumn]),
      y: toNumber(row[yColumn]),
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

  if (points.length < 3) {
    setHelper("At least three valid numeric rows are needed for clustering.", true);
    return;
  }

  const normalized = normalizePoints(points);
  const dbscanLabels = dbscan(normalized, Number(elements.epsInput.value), Number(elements.minPtsInput.value));
  const kmeansLabels = kmeans(normalized, Number(elements.kInput.value));
  const routeSummary = summarizeRoutes(state.rows, elements.routeColumn.value);
  const noiseTotal = dbscanLabels.filter((label) => label === -1).length;
  const dbscanTotal = new Set(dbscanLabels.filter((label) => label !== -1)).size;

  elements.rowCount.textContent = state.rows.length;
  elements.routeCount.textContent = routeSummary.length;
  elements.dbscanClusters.textContent = dbscanTotal;
  elements.noiseCount.textContent = noiseTotal;
  elements.modelStatus.textContent = "Analysis complete";

  renderSummary(routeSummary, dbscanTotal, noiseTotal, points.length, xColumn, yColumn);
  drawScatter(elements.dbscanCanvas, points, dbscanLabels, xColumn, yColumn, "Noise points are shown in red");
  drawScatter(elements.kmeansCanvas, points, kmeansLabels, xColumn, yColumn, "K-Means assigns every row to a group");
  drawRouteBars(elements.routeCanvas, routeSummary);
  renderPreview();
  setHelper("Analysis complete. Check the graphs and output summary.", false);
}

function normalizePoints(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);

  return points.map((point) => ({
    x: (point.x - xMin) / ((xMax - xMin) || 1),
    y: (point.y - yMin) / ((yMax - yMin) || 1),
  }));
}

function dbscan(points, eps, minPts) {
  const labels = Array(points.length).fill(undefined);
  let clusterId = 0;

  points.forEach((_, index) => {
    if (labels[index] !== undefined) return;

    const neighbors = regionQuery(points, index, eps);
    if (neighbors.length < minPts) {
      labels[index] = -1;
      return;
    }

    labels[index] = clusterId;
    const queue = [...neighbors];

    while (queue.length > 0) {
      const neighbor = queue.shift();
      if (labels[neighbor] === -1) labels[neighbor] = clusterId;
      if (labels[neighbor] !== undefined) continue;

      labels[neighbor] = clusterId;
      const nextNeighbors = regionQuery(points, neighbor, eps);
      if (nextNeighbors.length >= minPts) queue.push(...nextNeighbors);
    }

    clusterId += 1;
  });

  return labels;
}

function regionQuery(points, index, eps) {
  return points
    .map((point, candidate) => ({ candidate, distance: distance(points[index], point) }))
    .filter((item) => item.distance <= eps)
    .map((item) => item.candidate);
}

function kmeans(points, k) {
  const clusterCount = Math.max(2, Math.min(k, points.length));
  let centroids = points.slice(0, clusterCount).map((point) => ({ ...point }));
  let labels = Array(points.length).fill(0);

  for (let iteration = 0; iteration < 25; iteration += 1) {
    labels = points.map((point) => nearestCentroid(point, centroids));
    centroids = centroids.map((centroid, cluster) => {
      const members = points.filter((_, index) => labels[index] === cluster);
      if (members.length === 0) return centroid;
      return {
        x: average(members.map((point) => point.x)),
        y: average(members.map((point) => point.y)),
      };
    });
  }

  return labels;
}

function nearestCentroid(point, centroids) {
  let best = 0;
  let bestDistance = Infinity;

  centroids.forEach((centroid, index) => {
    const currentDistance = distance(point, centroid);
    if (currentDistance < bestDistance) {
      bestDistance = currentDistance;
      best = index;
    }
  });

  return best;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function summarizeRoutes(rows, routeColumn) {
  const studentColumn = findHeader(["student_count", "students", "count"], true);
  const occupancyColumn = findHeader(["occupancy_percent", "occupancy"], true);
  const groups = new Map();

  rows.forEach((row) => {
    const route = row[routeColumn] || "Unknown route";
    if (!groups.has(route)) groups.set(route, { route, rows: 0, students: 0, occupancy: [] });
    const item = groups.get(route);
    item.rows += 1;
    item.students += toNumber(row[studentColumn]) || 0;
    const occupancy = toNumber(row[occupancyColumn]);
    if (Number.isFinite(occupancy)) item.occupancy.push(occupancy);
  });

  return [...groups.values()]
    .map((item) => ({
      ...item,
      avgOccupancy: item.occupancy.length ? average(item.occupancy) : 0,
    }))
    .sort((a, b) => b.students - a.students);
}

function renderSummary(routeSummary, dbscanTotal, noiseTotal, validRows, xColumn, yColumn) {
  const topRoute = routeSummary[0];
  const lowestRoute = routeSummary[routeSummary.length - 1];
  const noisePercent = ((noiseTotal / validRows) * 100).toFixed(1);

  elements.summaryText.innerHTML = `
    <ul class="summary-list">
      <li><strong>${topRoute.route}</strong> has the highest demand with ${Math.round(topRoute.students)} total students in the uploaded data.</li>
      <li><strong>${lowestRoute.route}</strong> has the lowest demand and may need schedule review if buses are underused.</li>
      <li>DBSCAN found <strong>${dbscanTotal}</strong> natural density group${dbscanTotal === 1 ? "" : "s"} and marked <strong>${noisePercent}%</strong> of valid points as unusual travel records.</li>
      <li>K-Means groups every record, so it is useful for simple reporting, while DBSCAN is better for finding crowded zones and outliers.</li>
      <li>The graph currently compares <strong>${xColumn}</strong> against <strong>${yColumn}</strong>.</li>
    </ul>
  `;
}

function renderPreview() {
  const rows = state.rows.slice(0, 8);
  const headers = state.headers.slice(0, 8);
  elements.previewStatus.textContent = `${rows.length} of ${state.rows.length} rows`;

  elements.previewTable.innerHTML = `
    <thead>
      <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${rows.map((row) => `
        <tr>${headers.map((header) => `<td>${escapeHtml(row[header])}</td>`).join("")}</tr>
      `).join("")}
    </tbody>
  `;
}

function drawScatter(canvas, points, labels, xLabel, yLabel, note) {
  const ctx = canvas.getContext("2d");
  const bounds = chartBounds(canvas);
  clearCanvas(ctx, canvas);
  drawAxes(ctx, canvas, xLabel, yLabel, note);

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);

  points.forEach((point, index) => {
    const x = scale(point.x, xMin, xMax, bounds.left, bounds.right);
    const y = scale(point.y, yMin, yMax, bounds.bottom, bounds.top);
    const label = labels[index];

    ctx.beginPath();
    ctx.fillStyle = label === -1 ? "#d94848" : colors[Math.abs(label) % colors.length];
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
}

function drawRouteBars(canvas, routeSummary) {
  const ctx = canvas.getContext("2d");
  clearCanvas(ctx, canvas);

  const topRoutes = routeSummary.slice(0, 7);
  const maxStudents = Math.max(...topRoutes.map((route) => route.students), 1);
  const left = 150;
  const right = canvas.width - 34;
  const top = 54;
  const rowHeight = 44;

  ctx.fillStyle = "#172026";
  ctx.font = "700 18px Inter, Arial";
  ctx.fillText("Highest route demand", 24, 30);

  topRoutes.forEach((route, index) => {
    const y = top + index * rowHeight;
    const width = ((right - left) * route.students) / maxStudents;

    ctx.fillStyle = "#64727d";
    ctx.font = "700 13px Inter, Arial";
    ctx.fillText(truncate(route.route, 18), 24, y + 18);

    ctx.fillStyle = "#e6ece9";
    roundRect(ctx, left, y, right - left, 20, 10);
    ctx.fill();

    ctx.fillStyle = colors[index % colors.length];
    roundRect(ctx, left, y, width, 20, 10);
    ctx.fill();

    ctx.fillStyle = "#172026";
    ctx.font = "800 13px Inter, Arial";
    ctx.fillText(String(Math.round(route.students)), right - 28, y + 16);
  });
}

function clearCanvas(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fbfdfc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawAxes(ctx, canvas, xLabel, yLabel, note) {
  const bounds = chartBounds(canvas);
  ctx.strokeStyle = "#d9e2e6";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bounds.left, bounds.top);
  ctx.lineTo(bounds.left, bounds.bottom);
  ctx.lineTo(bounds.right, bounds.bottom);
  ctx.stroke();

  ctx.fillStyle = "#172026";
  ctx.font = "800 15px Inter, Arial";
  ctx.fillText(xLabel, bounds.left + 4, canvas.height - 18);

  ctx.save();
  ctx.translate(18, bounds.bottom - 4);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();

  ctx.fillStyle = "#64727d";
  ctx.font = "700 12px Inter, Arial";
  ctx.fillText(note, bounds.left, 28);
}

function chartBounds(canvas) {
  return {
    left: 56,
    right: canvas.width - 28,
    top: 42,
    bottom: canvas.height - 52,
  };
}

function scale(value, min, max, outputMin, outputMax) {
  return outputMin + ((value - min) / ((max - min) || 1)) * (outputMax - outputMin);
}

function roundRect(ctx, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
  ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
  ctx.arcTo(x, y + height, x, y, safeRadius);
  ctx.arcTo(x, y, x + width, y, safeRadius);
  ctx.closePath();
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toNumber(value) {
  if (value === undefined || value === null) return NaN;
  return Number(String(value).replace(/%/g, "").trim());
}

function truncate(value, length) {
  return value.length > length ? `${value.slice(0, length - 1)}...` : value;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setHelper(message, isError) {
  elements.helperText.textContent = message;
  elements.helperText.style.color = isError ? "#d94848" : "#64727d";
}

loadCsv(sampleCsv, "sample_transport_dataset.csv");
