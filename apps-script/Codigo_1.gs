// ---------------------------------------------------------------------------
// Recebe as cópias de segurança do Logbook e guarda-as numa pasta do Drive.
//
// Como publicar:
//   1. Vai a script.google.com e cria um projeto novo.
//   2. Apaga o que lá estiver e cola este ficheiro inteiro.
//   3. Implementar > Nova implementação > tipo "Aplicação web".
//   4. Executar como: Eu.  Quem tem acesso: Qualquer pessoa.
//   5. Autoriza quando pedir, copia o endereço que termina em /exec
//      e cola-o no campo de destino dentro da app.
//
// "Qualquer pessoa" significa que quem souber o endereço pode enviar
// ficheiros para esta pasta. Não é um segredo a partilhar, mas também não
// dá acesso a ler nada do teu Drive.
// ---------------------------------------------------------------------------

var FOLDER_NAME = 'Logbook Backups';
var KEEP = 15; // quantas cópias manter; as mais antigas são apagadas

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var name = body.filename || ('logbook-' + new Date().toISOString() + '.json');
    var content = JSON.stringify(body.data || body, null, 2);

    var folder = getFolder_();
    folder.createFile(name, content, MimeType.PLAIN_TEXT);
    prune_(folder);

    return json_({ ok: true, file: name });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// Permite abrir o endereço no browser para confirmar que está vivo.
function doGet() {
  return json_({ ok: true, service: 'Logbook backup', folder: FOLDER_NAME });
}

function getFolder_() {
  var it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}

// Mantém apenas as cópias mais recentes, para a pasta não crescer sem fim.
function prune_(folder) {
  var files = [];
  var it = folder.getFiles();
  while (it.hasNext()) files.push(it.next());

  files.sort(function (a, b) {
    return b.getDateCreated() - a.getDateCreated();
  });

  for (var i = KEEP; i < files.length; i++) {
    files[i].setTrashed(true);
  }
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
