# API (tiền tố `/api`, trả `{ok, data}` hoặc `{ok:false, error:{code,message}}`)
Auth: `POST /auth/register|login|refresh|logout`, `GET /auth/me`
Guest: `POST /guest/start|end|convert`, `GET /guest/session`
Player: `GET /player/state`, `PATCH /player/profile`, `POST /player/inventory/use`
Game: `GET /game/npcs`, `POST /game/areas/:id/enter`, `POST /game/npcs/:id/talk`, `POST /game/pois/:id/collect`, `POST /game/quests/:id/start|claim`
Mini game: `GET /minigames/:id`, `POST /minigames/:id/start|dig|submit`
Cộng đồng: `GET /leaderboard[/daily|/weekly]`, `GET|POST /gratitude`, `POST /gratitude/generate`, `DELETE /gratitude/:id`, `POST /gratitude/:id/report`
Admin (role admin): `/admin/dashboard|users|gratitude|reports|settings` và CRUD `/admin/{quests,npcs,areas,minigames,questions,items,achievements}`
