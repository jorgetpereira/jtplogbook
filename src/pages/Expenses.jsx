import { useState, useEffect, useRef } from "react";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { base44 } from "@/api/base44Client";
import { enqueue } from "@/lib/offlineQueue";
import { saveCache, loadCache } from "@/lib/dataCache";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { maybeCreateAutoNotification } from "@/lib/autoNotifications";
import { Plus, Fuel, Wrench, Search, Filter, BookOpen, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ExpenseForm from "../components/expenses/ExpenseForm";
import ExpenseRow from "../components/expenses/ExpenseRow";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [defaultCategory, setDefaultCategory] = useState(null);
  const [filterVehicle, setFilterVehicle] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [search, setSearch] = useState("");
  const [fabOpen, setFabOpen] = useState(false);
  const fabRef = useRef(null);
  const { isOnline, refresh: refreshOffline } = useOfflineSync();

  const load = async () => {
    try {
      const [e, v] = await Promise.all([
        base44.entities.Expense.list("-date", 500),
        base44.entities.Vehicle.list()
      ]);
      setExpenses(e);
      setVehicles(v);
      saveCache('expenses', e);
      saveCache('vehicles', v);
    } catch {
      // Offline — restaurar dados em cache
      setExpenses(loadCache('expenses') || []);
      setVehicles(loadCache('vehicles') || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  const refreshing = usePullToRefresh(load);

  // Close FAB menu when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (fabRef.current && !fabRef.current.contains(e.target)) setFabOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const openNew = (category) => {
    setEditExpense(null);
    setDefaultCategory(category);
    setFabOpen(false);
    setDialogOpen(true);
  };

  const handleSave = async (data) => {
    const tempId = `temp-${Date.now()}`;
    if (!editExpense) {
      setExpenses(prev => [{ ...data, id: tempId }, ...prev]);
    } else {
      setExpenses(prev => prev.map(e => e.id === editExpense.id ? { ...e, ...data } : e));
    }
    setDialogOpen(false);
    setEditExpense(null);
    setDefaultCategory(null);
    const isNew = !editExpense;
    if (!isOnline) {
      enqueue({
        entity: 'Expense',
        action: editExpense ? 'update' : 'create',
        recordId: editExpense?.id,
        payload: data,
      });
      refreshOffline();
      return;
    }
    if (editExpense) {
      await base44.entities.Expense.update(editExpense.id, data);
    } else {
      await base44.entities.Expense.create(data);
    }
    await maybeCreateAutoNotification(data, isNew);
    load();
  };

  const handleDelete = async (id) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
    if (!isOnline) {
      enqueue({ entity: 'Expense', action: 'delete', recordId: id, payload: {} });
      refreshOffline();
      return;
    }
    await base44.entities.Expense.delete(id);
    load();
  };

  const vehicleMap = {};
  vehicles.forEach(v => { vehicleMap[v.id] = v; });

  const filtered = expenses.filter(e => {
    if (filterVehicle !== "all" && e.vehicle_id !== filterVehicle) return false;
    if (filterCategory !== "all") {
      if (filterCategory === "Portagens") {
        if (e.sub_category !== "Portagens") return false;
      } else if (e.category !== filterCategory) return false;
    }
    if (filterFrom && (e.date || "") < filterFrom) return false;
    if (filterTo && (e.date || "") > filterTo) return false;
    if (search) {
      const s = search.toLowerCase();
      return (e.sub_category?.toLowerCase().includes(s) || e.description?.toLowerCase().includes(s) || e.location?.toLowerCase().includes(s));
    }
    return true;
  });

  const hasActiveFilters = filterVehicle !== "all" || filterCategory !== "all" || filterFrom || filterTo || search;
  const clearFilters = () => {
    setFilterVehicle("all");
    setFilterCategory("all");
    setFilterFrom("");
    setFilterTo("");
    setSearch("");
  };

  // Group by date for display
  const grouped = {};
  filtered.forEach(e => {
    const key = e.date;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  });
  const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      {refreshing && (
        <div className="flex justify-center py-2">
          <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-primary" />
          Logbook
        </h1>
        <p className="text-muted-foreground mt-1">Todas as despesas por data</p>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Pesquisar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 rounded-xl" />
          </div>
          <Select value={filterVehicle} onValueChange={setFilterVehicle}>
            <SelectTrigger className="w-full sm:w-52 rounded-xl">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Veículo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Veículos</SelectItem>
              {vehicles.map(v => (
                <SelectItem key={v.id} value={v.id}>{v.brand} {v.model}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-full sm:w-48 rounded-xl">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              <SelectItem value="Combustível">Combustível</SelectItem>
              <SelectItem value="Manutenção">Manutenção</SelectItem>
              <SelectItem value="Portagens">Portagens</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="flex items-center gap-2 flex-1 w-full">
            <span className="text-xs text-muted-foreground shrink-0">De</span>
            <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="rounded-xl" />
            <span className="text-xs text-muted-foreground shrink-0">até</span>
            <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="rounded-xl" />
          </div>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium whitespace-nowrap px-2 py-1">
              <X className="w-3 h-3" /> Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Logbook continuous by date */}
      {filtered.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-12 text-center">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Sem registos</h3>
          <p className="text-muted-foreground text-sm mt-1">Prima o botão + para adicionar a primeira despesa.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map(date => (
            <div key={date}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                  {format(new Date(date + "T12:00:00"), "d MMM yyyy", { locale: pt })}
                </div>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">
                  €{grouped[date].reduce((s, e) => s + (e.amount || 0), 0).toFixed(2)}
                </span>
              </div>
              {/* Entries for this date */}
              <div className="bg-card rounded-2xl border border-border overflow-hidden divide-y divide-border">
                {grouped[date].map(expense => (
                  <ExpenseRow
                    key={expense.id}
                    expense={expense}
                    vehicle={vehicleMap[expense.vehicle_id]}
                    onEdit={() => { setEditExpense(expense); setDefaultCategory(expense.category); setDialogOpen(true); }}
                    onDelete={() => handleDelete(expense.id)}
                  />
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground text-center pt-2">
            Total: €{filtered.reduce((s, e) => s + (e.amount || 0), 0).toFixed(2)} · {filtered.length} registos
          </p>
        </div>
      )}

      {/* Fixed FAB */}
      <div ref={fabRef} className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-3">
        {/* Menu options */}
        {fabOpen && (
          <div className="flex flex-col gap-2 items-end">
            <button
              onClick={() => openNew("Manutenção")}
              className="flex items-center gap-3 bg-card border border-border shadow-lg rounded-2xl px-4 py-3 hover:bg-muted transition-colors text-sm font-medium"
            >
              <span>Manutenção</span>
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                <Wrench className="w-4 h-4 text-amber-600" />
              </div>
            </button>
            <button
              onClick={() => openNew("Combustível")}
              className="flex items-center gap-3 bg-card border border-border shadow-lg rounded-2xl px-4 py-3 hover:bg-muted transition-colors text-sm font-medium"
            >
              <span>Combustível</span>
              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                <Fuel className="w-4 h-4 text-blue-600" />
              </div>
            </button>
          </div>
        )}

        {/* FAB Button */}
        <button
          onClick={() => setFabOpen(!fabOpen)}
          className={cn(
            "w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all",
            fabOpen
              ? "bg-muted-foreground text-white rotate-45"
              : "bg-primary text-primary-foreground hover:scale-110 shadow-primary/30"
          )}
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setEditExpense(null); setDefaultCategory(null); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto pb-8">
          <DialogHeader>
            <DialogTitle>{editExpense ? "Editar Despesa" : defaultCategory ? `Nova Despesa — ${defaultCategory}` : "Nova Despesa"}</DialogTitle>
          </DialogHeader>
          <ExpenseForm
            expense={editExpense}
            vehicles={vehicles}
            onSave={handleSave}
            onCancel={() => { setDialogOpen(false); setEditExpense(null); setDefaultCategory(null); }}
            defaultCategory={defaultCategory}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}