/**
 * Gera conteúdo .ics para um ou mais eventos de lembrete.
 */
function buildICal(events) {
  let iCal = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//O Meu Logbook//Notifications//PT\nCALSCALE:GREGORIAN\n";
  const dtstamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  events.forEach(ev => {
    const dateStart = ev.due_date.replace(/-/g, "");
    const dateEnd = new Date(ev.due_date);
    dateEnd.setDate(dateEnd.getDate() + 1);
    const dateEndStr = dateEnd.toISOString().split("T")[0].replace(/-/g, "");
    const uid = `${ev.id || Date.now()}-notification@omeulogbook.local`;
    const desc = ev.description || "";

    iCal += `BEGIN:VEVENT\nUID:${uid}\nDTSTART;VALUE=DATE:${dateStart}\nDTEND;VALUE=DATE:${dateEndStr}\nDTSTAMP:${dtstamp}\nSUMMARY:${ev.title}\nDESCRIPTION:${desc}\nEND:VEVENT\n`;
  });

  iCal += "END:VCALENDAR";
  return iCal;
}

/**
 * Descarrega ou partilha um ficheiro .ics.
 * Tenta navigator.share (Android share sheet → apps de calendário),
 * depois window.open com blob URL, e por fim anchor no DOM.
 */
export async function downloadOrShareICal(events, filename) {
  if (!events || events.length === 0) {
    alert("Sem lembretes pendentes para adicionar.");
    return;
  }

  const iCal = buildICal(events);
  const blob = new Blob([iCal], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  // 1) Web Share API — Android mostra a folha de partilha com apps de calendário
  if (navigator.share) {
    try {
      const file = new File([blob], filename, { type: "text/calendar;charset=utf-8" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        URL.revokeObjectURL(url);
        return;
      }
    } catch (err) {
      if (err.name === "AbortError") {
        URL.revokeObjectURL(url);
        return; // utilizador cancelou
      }
    }
  }

  // 2) Download via anchor — método mais fiável em PWA/mobile
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 2000);
}

/**
 * Constrói a descrição de um lembrete para o .ics.
 */
export function buildEventDescription(notif, vehicle) {
  const vehicleName = vehicle ? ` · ${vehicle.brand} ${vehicle.model}` : "";
  return `${notif.type}${notif.message ? " - " + notif.message : ""}${vehicleName}`;
}