<?php
namespace Banisor\Game;

use DateTimeImmutable;
use DateTimeZone;

final class GameDefaults
{
    public const SEASONS = ['primavara', 'vara', 'toamna', 'iarna'];
    public const OPEN_MINUTE = 8 * 60; // 08:00
    public const DAY_MINUTES = 8 * 60; // 8h zi de lucru

    public static function create(int $startCash = 1000): array
    {
        $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));

        return [
            'meta' => [
                'version' => 1,
                'last_tick' => $now->format(DATE_ATOM),
                'smart_manager' => true,
                'user_token' => 'default',
            ],
            'cash' => $startCash,
            'reputation' => 1.00,
            'world' => [
                'year' => 1,
                'season' => self::SEASONS[0],
                'day' => 1,
                'minute' => self::OPEN_MINUTE,
            ],
            'economy' => [
                'base_customers' => 120,
                'season_modifiers' => [
                    'primavara' => 1.05,
                    'vara' => 1.10,
                    'toamna' => 0.95,
                    'iarna' => 0.90,
                ],
            ],
            'policy' => [
                'smart_manager' => true,
                'focus' => 'balanced',
                'cash_reserve' => 0.15,
            ],
            'product' => [
                'key' => 'croissant',
                'name' => 'Croissant',
                'base_price' => 10.0,
                'price' => 10.0,
                'planned_qty' => 120,
                'stock_qty' => 0,
                'avg_quality' => 0.90,
                'cost_per_unit' => 3.2,
            ],
            'staff' => [
                'cashiers' => 1,
                'wage_per_day' => 80,
            ],
            'metrics' => [
                'sold_today' => 0,
                'revenue_today' => 0.0,
                'profit_today' => 0.0,
                'last_summary' => null,
                'history' => [],
            ],
            'plan' => [
                'planned_qty' => 120,
                'price' => 10.0,
                'cashiers' => 1,
                'expected_customers' => 0,
            ],
            'runtime' => [],
        ];
    }
}
