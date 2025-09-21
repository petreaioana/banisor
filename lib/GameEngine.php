<?php
namespace Banisor\Game;

use DateInterval;
use DateTimeImmutable;
use DateTimeZone;

final class GameEngine
{
    private const MAX_OFFLINE_MINUTES = GameDefaults::DAY_MINUTES * 7; // 7 zile de joc

    public function advanceToNow(array $state, ?DateTimeImmutable $now = null): array
    {
        $now = $now ?: new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $lastTickIso = $state['meta']['last_tick'] ?? $now->format(DATE_ATOM);
        $lastTick = new DateTimeImmutable($lastTickIso ?? 'now', new DateTimeZone('UTC'));

        $diffMinutes = (int) max(0, floor(($now->getTimestamp() - $lastTick->getTimestamp()) / 60));
        $minutes = min(self::MAX_OFFLINE_MINUTES, $diffMinutes);
        if ($minutes <= 0) {
            $state['meta']['last_tick'] = $now->format(DATE_ATOM);
            return $state;
        }

        for ($i = 0; $i < $minutes; $i++) {
            $state = $this->tickMinute($state);
        }

        $state['meta']['last_tick'] = $now->format(DATE_ATOM);
        return $state;
    }

    public function tickMinute(array $state): array
    {
        $currentDay = $state['world']['day'] ?? 1;
        $plannedDay = $state['runtime']['planned_day'] ?? null;
        if ($plannedDay !== $currentDay) {
            $state = $this->startDay($state);
        }

        $minute = $state['world']['minute'] ?? GameDefaults::OPEN_MINUTE;
        $minute += 1;
        $state['world']['minute'] = $minute;

        $endMinute = GameDefaults::OPEN_MINUTE + GameDefaults::DAY_MINUTES;
        if ($minute > $endMinute) {
            $state = $this->endDay($state);
            $state = $this->startDay($state);
            return $state;
        }

        $state = $this->simulateMinute($state);
        return $state;
    }

    private function startDay(array $state): array
    {
        $state['world']['minute'] = GameDefaults::OPEN_MINUTE;
        $state['runtime'] = $state['runtime'] ?? [];
        $plan = AutoManager::planDay($state);

        $state['metrics']['sold_today'] = 0;
        $state['metrics']['revenue_today'] = 0.0;
        $state['metrics']['profit_today'] = 0.0;

        $productionCost = $plan['planned_qty'] * ($state['product']['cost_per_unit'] ?? 3.2);
        $cash = $state['cash'] ?? 0;
        if ($productionCost > 0) {
            $state['cash'] = max(0.0, $cash - $productionCost);
        }

        $existingStock = max(0, $state['product']['stock_qty'] ?? 0);
        $existingQuality = $state['product']['avg_quality'] ?? 0.90;
        $totalStock = $existingStock + $plan['planned_qty'];
        if ($totalStock > 0) {
            $newQuality = 0.92;
            $state['product']['avg_quality'] = (($existingStock * $existingQuality) + ($plan['planned_qty'] * $newQuality)) / $totalStock;
        } else {
            $state['product']['avg_quality'] = 0.92;
        }
        $state['product']['stock_qty'] = $totalStock;

        $state['runtime']['planned_day'] = $state['world']['day'] ?? 1;
        $state['runtime']['production_cost'] = $productionCost;

        return $state;
    }

    private function simulateMinute(array $state): array
    {
        $plan = $state['plan'];
        $stock = $state['product']['stock_qty'] ?? 0;
        if ($stock <= 0) {
            return $state;
        }

        $expectedCustomers = max(10, $plan['expected_customers'] ?? 120);
        $lambda = $expectedCustomers / GameDefaults::DAY_MINUTES;

        $price = $state['product']['price'] ?? 10.0;
        $basePrice = $state['product']['base_price'] ?? 10.0;
        $quality = $state['product']['avg_quality'] ?? 0.9;

        $priceFactor = exp(-1.35 * (($price / max(0.01, $basePrice)) - 1));
        $qualityFactor = 0.7 + 0.3 * $quality;
        $conversion = max(0.10, min(0.95, 0.4 + 0.45 * $priceFactor * $qualityFactor));

        $demand = (int) round($lambda * $conversion);
        if ($demand < 0) {
            $demand = 0;
        }

        $sold = min($stock, $demand);
        if ($sold > 0) {
            $state['product']['stock_qty'] -= $sold;
            $state['metrics']['sold_today'] += $sold;
            $revenue = $sold * $price;
            $state['metrics']['revenue_today'] += $revenue;
            $state['cash'] = ($state['cash'] ?? 0) + $revenue;
        }

        return $state;
    }

    private function endDay(array $state): array
    {
        $plan = $state['plan'];
        $sold = $state['metrics']['sold_today'] ?? 0;
        $revenue = $state['metrics']['revenue_today'] ?? 0.0;
        $productionCost = $state['runtime']['production_cost'] ?? 0.0;
        $payroll = ($state['staff']['cashiers'] ?? 1) * ($state['staff']['wage_per_day'] ?? 80);

        $state['cash'] = max(0.0, ($state['cash'] ?? 0) - $payroll);
        $profit = $revenue - $productionCost - $payroll;
        $state['metrics']['profit_today'] = $profit;

        $plannedQty = max(1, $plan['planned_qty'] ?? 1);
        $soldRatio = $sold / $plannedQty;
        $quality = $state['product']['avg_quality'] ?? 0.9;

        $newReputation = ($state['reputation'] ?? 1.0) * 0.85 + $soldRatio * 0.25 + ($quality - 0.9) * 0.5;
        $state['reputation'] = max(0.6, min(1.4, $newReputation));

        $leftover = $state['product']['stock_qty'] ?? 0;
        $state['product']['stock_qty'] = (int) floor($leftover * 0.90);

        $stars = 0;
        if ($soldRatio >= 0.6) {
            $stars = 1;
        }
        if ($soldRatio >= 0.8 && $quality >= 0.9) {
            $stars = 2;
        }
        if ($soldRatio >= 0.8 && $profit > 0) {
            $stars = 3;
        }

        $summary = [
            'day' => $state['world']['day'] ?? 1,
            'season' => $state['world']['season'] ?? 'primavara',
            'sold' => $sold,
            'planned' => $plannedQty,
            'revenue' => round($revenue, 2),
            'profit' => round($profit, 2),
            'price' => round($state['product']['price'] ?? 0, 2),
            'stars' => $stars,
        ];

        $state['metrics']['last_summary'] = $summary;
        $history = $state['metrics']['history'] ?? [];
        array_unshift($history, $summary);
        $state['metrics']['history'] = array_slice($history, 0, 14);

        $state['world']['day'] = ($state['world']['day'] ?? 1) + 1;
        if ($state['world']['day'] > 28) {
            $state['world']['day'] = 1;
            $state['world']['season'] = $this->nextSeason($state['world']['season'] ?? 'primavara');
            $state['world']['year'] = ($state['world']['year'] ?? 1) + 1;
        }

        $state['runtime']['planned_day'] = null;
        $state['runtime']['production_cost'] = 0.0;

        return $state;
    }

    private function nextSeason(string $current): string
    {
        $index = array_search($current, GameDefaults::SEASONS, true);
        if ($index === false) {
            return GameDefaults::SEASONS[0];
        }
        $index = ($index + 1) % count(GameDefaults::SEASONS);
        return GameDefaults::SEASONS[$index];
    }
}
