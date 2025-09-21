<?php
namespace Banisor\Game;

final class AutoManager
{
    public static function planDay(array &$state): array
    {
        $focus = $state['policy']['focus'] ?? 'balanced';
        $baseCustomers = $state['economy']['base_customers'] ?? 120;
        $season = $state['world']['season'] ?? 'primavara';
        $seasonMultiplier = $state['economy']['season_modifiers'][$season] ?? 1.0;
        $reputation = max(0.6, min(1.4, $state['reputation'] ?? 1.0));

        $expectedCustomers = $baseCustomers * $seasonMultiplier * $reputation;

        $price = $state['product']['base_price'] ?? 10.0;
        $planMultiplier = 0.90;
        $priceAdjust = 1.0;

        switch ($focus) {
            case 'profit':
                $planMultiplier = 0.78;
                $priceAdjust = 1.07;
                break;
            case 'happy':
                $planMultiplier = 1.18;
                $priceAdjust = 0.95;
                break;
            default:
                $planMultiplier = 0.90;
                $priceAdjust = 1.00;
        }

        $plannedQty = (int) max(40, round($expectedCustomers * $planMultiplier));
        $targetPrice = round(($state['product']['base_price'] ?? 10.0) * $priceAdjust, 2);

        $costPerUnit = $state['product']['cost_per_unit'] ?? 3.2;
        $budgetNeeded = $plannedQty * $costPerUnit;
        $cash = $state['cash'] ?? 0;
        $reserveRatio = $state['policy']['cash_reserve'] ?? 0.15;
        $reserve = $cash * $reserveRatio;

        if ($cash <= 0) {
            $plannedQty = 0;
        } elseif (($cash - $budgetNeeded) < $reserve) {
            $affordableQty = (int) max(0, floor(($cash - $reserve) / max(0.01, $costPerUnit)));
            $plannedQty = max(20, min($plannedQty, $affordableQty));
        }

        if ($plannedQty < 20) {
            $plannedQty = 20;
        }

        $cashiers = $plannedQty > 160 ? 2 : 1;

        $plan = [
            'planned_qty' => $plannedQty,
            'price' => $targetPrice,
            'cashiers' => $cashiers,
            'expected_customers' => (int) round($expectedCustomers),
            'budget_needed' => round($plannedQty * $costPerUnit, 2),
        ];

        $state['plan'] = $plan;
        $state['product']['planned_qty'] = $plannedQty;
        $state['product']['price'] = $targetPrice;
        $state['staff']['cashiers'] = $cashiers;

        return $plan;
    }
}
