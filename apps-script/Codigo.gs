// ---------------------------------------------------------------------------
// Logbook — serviço no Google Drive
//
// Faz três coisas, conforme o campo "action" do pedido:
//   backup  → guarda uma cópia integral em JSON numa pasta do Drive
//   sheets  → escreve os dados na folha de cálculo, um separador por tabela
//   both    → as duas anteriores de uma vez
//   upload  → recebe um documento, guarda-o no Drive e devolve o endereço
//
// Como publicar:
//   1. script.google.com > Novo projeto
//   2. Cola este ficheiro inteiro, apagando o que lá estiver
//   3. Confirma o SHEET_ID abaixo
//   4. Implementar > Nova implementação > Aplicação web
//      Executar como: Eu.  Quem tem acesso: Qualquer pessoa.
//   5. Autoriza e copia o endereço terminado em /exec para a app
//
// Se já tinhas a versão anterior publicada, usa Implementar > Gerir
// implementações > lápis > Nova versão, para manteres o mesmo endereço.
// ---------------------------------------------------------------------------

var SHEET_ID = '1tImWoKly5EyBMX5bQQwa0dBawpzzVoJ_wf4wodlC3KA';
var BACKUP_FOLDER = 'Logbook Backups';
var DOCS_FOLDER = 'Logbook Documentos';
var KEEP_BACKUPS = 15;

// Cabeçalhos exactos de cada separador, na ordem em que já estão na folha.
// Manter esta ordem é o que permite que as fórmulas e gráficos construídos
// por cima continuem a funcionar depois de cada sincronização.
var SHEETS = {
  'Despesas': {
    source: 'expenses',
    headers: ['id','date','tank_percentage','amount','sub_category','liters','owner_id','car_avg_consumption','maintenance_type','description','full_tank','receipt_url','mileage_at_expense','location','category','price_per_unit','vehicle_id','created_date','updated_date','created_by_id','created_by','is_sample']
  },
  'Carregamentos': {
    source: 'chargings',
    headers: ['id','soc_start_pct','notes','odometer','total_cost','start_datetime','end_datetime','car_avg_consumption','kwh_end','kwh_added','location_type','location_name','duration_minutes','soc_end_pct','range_km','price_per_kwh','vehicle_id','created_date','updated_date','created_by_id','created_by','is_sample']
  },
  'Lembretes': {
    source: 'notifications',
    headers: ['id','is_read','due_date','title','message','type','calendar_event_id','vehicle_id','is_completed','created_date','updated_date','created_by_id','created_by','is_sample']
  },
  'Avarias': {
    source: 'issues',
    onlyResolved: false,
    headers: ['id','notes','odometer','resolved_date','image_urls','detected_date','title','category','vehicle_id','resolved_notes','status','created_date','updated_date','created_by_id','created_by','is_sample']
  },
  'Historico': {
    source: 'issues',
    onlyResolved: true,
    headers: ['id','notes','odometer','resolved_date','image_urls','detected_date','title','category','vehicle_id','resolved_notes','status','created_date','updated_date','created_by_id','created_by','is_sample']
  },
  'Componentes': {
    source: 'parts',
    headers: ['id','next_replacement_date','next_replacement_km','cost','notes','reference','installation_mileage','installation_date','supplier','name','warranty_date','category','vehicle_id','expense_id','brand','created_date','updated_date','created_by_id','created_by','is_sample']
  },
  'Documentos': {
    source: 'docs',
    headers: ['id','date','file_url','notes','title','category','vehicle_id','expense_id','created_date','updated_date','created_by_id','created_by','is_sample']
  },
  'Veiculos': {
    source: 'vehicles',
    headers: ['id','advertised_consumption_electric','notes','is_active','color','year','fuel_range','image_url','advertised_consumption','battery_reserve_pct','loan_amount','fuel_reserve_liters','last_maintenance_date','license_plate','registration_date','model','last_maintenance_km','battery_capacity','fuel_type','brand','tank_size','mileage','electric_range','created_date','updated_date','created_by_id','created_by','is_sample']
  },
  'Manutencoes': {
    source: 'schedules',
    headers: ['id','interval_months','is_active','warning_km','last_done_date','name','last_done_km','interval_km','vehicle_id','created_date','updated_date','created_by_id','created_by','is_sample']
  },
  'Seguros': {
    source: 'insurances',
    headers: ['id','end_date','notes','is_active','policy_number','agent_name','insurer','premium_amount','agent_phone','green_card_url','vehicle_id','start_date','coverage_type','created_date','updated_date','created_by_id','created_by','is_sample']
  },
  'Locais': {
    source: 'locations',
    headers: ['id','name','type','created_date','updated_date','created_by_id','created_by','is_sample']
  },
  'Checklists': {
    source: 'checklists',
    headers: ['id','date','odometer','overall_condition','checked_items','general_notes','vehicle_id','created_date','updated_date','created_by_id','created_by','is_sample']
  }
};

// Separador calculado: pagamentos de crédito com os totais acumulados.
var LOAN_HEADERS = ['id','date','vehicle','license_plate','sub_category','payment_amount','description','initial_loan','total_paid','remaining'];

// ---------------------------------------------------------------------------

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action || 'backup';

    if (action === 'upload') return json_(saveDocument_(body));
    if (action === 'sheets') return json_(writeSheets_(body.data || {}));

    if (action === 'both') {
      var a = saveBackup_(body);
      var b = writeSheets_(body.data || {});
      return json_({ ok: a.ok && b.ok, backup: a, sheets: b });
    }

    return json_(saveBackup_(body));
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json_({ ok: true, service: 'Logbook', sheet: SHEET_ID ? 'configurada' : 'por configurar' });
}

// --- cópia em JSON ---------------------------------------------------------

function saveBackup_(body) {
  var name = body.filename || ('logbook-' + new Date().toISOString() + '.json');
  var folder = folderByName_(BACKUP_FOLDER);
  folder.createFile(name, JSON.stringify(body.data || body, null, 2), MimeType.PLAIN_TEXT);
  prune_(folder, KEEP_BACKUPS);
  return { ok: true, file: name };
}

// --- folha de cálculo ------------------------------------------------------

function writeSheets_(data) {
  if (!SHEET_ID) return { ok: false, error: 'SHEET_ID por preencher' };

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var written = {};

  for (var tab in SHEETS) {
    var spec = SHEETS[tab];
    var rows = data[spec.source] || [];

    if (spec.onlyResolved === true) {
      rows = rows.filter(function (r) { return r.status === 'Resolvido'; });
    } else if (spec.onlyResolved === false) {
      rows = rows.filter(function (r) { return r.status !== 'Resolvido'; });
    }

    writeTab_(ss, tab, spec.headers, rows);
    written[tab] = rows.length;
  }

  written['Emprestimos'] = writeLoans_(ss, data);
  return { ok: true, rows: written };
}

function writeTab_(ss, name, headers, rows) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  sheet.clearContents();

  var values = [headers];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i] || {};
    var line = [];
    for (var c = 0; c < headers.length; c++) line.push(cell_(row[headers[c]]));
    values.push(line);
  }

  sheet.getRange(1, 1, values.length, headers.length).setValues(values);
  sheet.setFrozenRows(1);
}

// Pagamentos de crédito, com o acumulado por veículo.
function writeLoans_(ss, data) {
  var expenses = (data.expenses || []).filter(function (x) {
    return x.sub_category === 'Crédito';
  });

  expenses.sort(function (a, b) {
    return String(a.date || '').localeCompare(String(b.date || ''));
  });

  var vehicles = {};
  (data.vehicles || []).forEach(function (v) { vehicles[v.id] = v; });

  var paid = {};
  var rows = [];

  expenses.forEach(function (x) {
    var v = vehicles[x.vehicle_id] || {};
    var initial = Number(v.loan_amount || 0);
    paid[x.vehicle_id] = (paid[x.vehicle_id] || 0) + Number(x.amount || 0);

    rows.push({
      id: x.id,
      date: x.date,
      vehicle: [v.brand, v.model].filter(String).join(' '),
      license_plate: v.license_plate || '',
      sub_category: x.sub_category,
      payment_amount: x.amount,
      description: x.description || '',
      initial_loan: initial || '',
      total_paid: round2_(paid[x.vehicle_id]),
      remaining: initial ? round2_(initial - paid[x.vehicle_id]) : ''
    });
  });

  var sheetName = ss.getSheetByName('Empréstimos') ? 'Empréstimos' : 'Emprestimos';
  writeTab_(ss, sheetName, LOAN_HEADERS, rows);
  return rows.length;
}

// --- documentos ------------------------------------------------------------

function saveDocument_(body) {
  var folder = folderByName_(DOCS_FOLDER);
  var bytes = Utilities.base64Decode(body.base64);
  var blob = Utilities.newBlob(bytes, body.mimeType || 'application/octet-stream', body.filename || 'documento');

  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var id = file.getId();
  var isImage = String(body.mimeType || '').indexOf('image/') === 0;

  // As imagens vão pelo endereço de miniatura, que é o único que o browser
  // aceita dentro de uma etiqueta <img>. Os restantes abrem numa página.
  var url = isImage
    ? 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1600'
    : 'https://drive.google.com/file/d/' + id + '/view';

  return { ok: true, id: id, url: url, view: 'https://drive.google.com/file/d/' + id + '/view' };
}

// --- utilitários -----------------------------------------------------------

function folderByName_(name) {
  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

function prune_(folder, keep) {
  var files = [];
  var it = folder.getFiles();
  while (it.hasNext()) files.push(it.next());
  files.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  for (var i = keep; i < files.length; i++) files[i].setTrashed(true);
}

// Listas e objectos vão como texto, para caberem numa célula.
function cell_(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function round2_(n) {
  return Math.round(Number(n) * 100) / 100;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
