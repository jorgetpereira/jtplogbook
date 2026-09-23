import { base44 } from "@/api/base44Client";

/**
 * Atualiza o odómetro (mileage) do veículo se o novo valor for superior ao atual.
 * Usado ao criar/editar despesas e avarias para manter a quilometragem do veículo sempre atualizada.
 */
export async function syncVehicleMileage(vehicleId, newKm) {
  if (!vehicleId || newKm == null || newKm === "") return;
  const km = Number(newKm);
  if (!Number.isFinite(km) || km <= 0) return;
  try {
    const vehicle = await base44.entities.Vehicle.get(vehicleId);
    const current = Number(vehicle?.mileage) || 0;
    if (km > current) {
      await base44.entities.Vehicle.update(vehicleId, { mileage: km });
    }
  } catch (e) {
    // silencioso — não bloquear o fluxo principal
  }
}