alter table achievements add column if not exists rarity text not null default 'common';

update achievements set rarity = 'common' where id in ('first_victory', 'fast_starter');
update achievements set rarity = 'rare' where id in ('hat_trick_hero', 'wall', 'captain_fantastic', 'perfect_transfer', 'fortress');
update achievements set rarity = 'epic' where id in ('goal_machine', 'differential_king');
update achievements set rarity = 'legendary' where id in ('five_green_arrows', 'century_club');
