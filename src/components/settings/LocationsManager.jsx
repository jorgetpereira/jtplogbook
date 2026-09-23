import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { MapPin, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";


const TYPE_COLORS = {
  "Combustível": "bg-blue-50 text-blue-700 border-blue-100",
  "Eletricidade": "bg-amber-50 text-amber-700 border-amber-100",
  "Manutenção": "bg-orange-50 text-orange-700 border-orange-100",
  "Geral": "bg-gray-50 text-gray-600 border-gray-100",
};

export default function LocationsManager() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("Geral");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const data = await base44.entities.Location.list("name");
    setLocations(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    await base44.entities.Location.create({ name: newName.trim(), type: newType });
    setNewName("");
    await load();
    setSaving(false);
  };

  const handleDelete = async (id) => {
    await base44.entities.Location.delete(id);
    setLocations(prev => prev.filter(l => l.id !== id));
  };

  const types = ["Combustível", "Eletricidade", "Manutenção", "Geral"];

  return (
    <div className="space-y-4">
      {/* Add new */}
      <form onSubmit={handleAdd} className="flex gap-2">
        <Input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Nome do local (ex: Casa, Shell A1...)"
          className="flex-1"
        />
        <select
          value={newType}
          onChange={e => setNewType(e.target.value)}
          className="w-36 shrink-0 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <Button type="submit" size="icon" disabled={saving || !newName.trim()} className="shrink-0">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        </Button>
      </form>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : locations.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>Nenhum local guardado.<br />Adicione acima.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {locations.map(loc => (
            <div key={loc.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/50 border border-border">
              <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="flex-1 text-sm font-medium">{loc.name}</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${TYPE_COLORS[loc.type] || TYPE_COLORS["Geral"]}`}>
                {loc.type}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => handleDelete(loc.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}