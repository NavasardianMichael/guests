# Backups to Google Drive

Every night, the server dumps the production database to Google Drive, into a folder
`guests-seating-board-backups`. Dumps are kept 22 days. The database is the app's only state —
lists, accounts, payments and download records — so the dump is the whole backup. The
`Payment` and `PdfDownload` rows are also the accounting record and the refund evidence.

The deploy also writes a dump just before each `prisma migrate deploy`, to
`/home/michael/apps/guests-seating-board/backups/pre-deploy-*.dump` (the last 5 kept). That one
is for undoing a bad migration; it lives on the same disk, so it is not a backup.

**Already in place:** rclone is on the server, with the remote `gdrive` connected to the backup
Google account (set up once for Crossword, in its `docs/PRODUCTION_SETUP.md` step 8), and
`michael` is in the `docker` group. Check both:

```bash
rclone lsd gdrive:      # lists the Drive folders, e.g. crossword-backups, cv-builder-backups
groups                  # lists docker
```

Run every command below as `michael`, never with `sudo` (except the one `chown`): root has no
`gdrive` remote.

## 1. Install the script **[SRV]** (once)

After the first deploy, once the database exists. Paste [backup-db.sh](../deployment/backup-db.sh)
into:

```bash
nano /home/michael/apps/guests-seating-board/shared/backup-db.sh
```

Make `michael` its owner. If `shared/` or the file was created as root, the script fails with
`Permission denied` without this; if `michael` already owns it, the command changes nothing:

```bash
sudo chown michael:michael /home/michael/apps/guests-seating-board/shared/backup-db.sh
```

Then make it executable and run it once, without `sudo`:

```bash
chmod 700 /home/michael/apps/guests-seating-board/shared/backup-db.sh
/home/michael/apps/guests-seating-board/shared/backup-db.sh
rclone ls gdrive:guests-seating-board-backups
```

The run creates the Drive folder and should print `ok: guests-<date>.dump (<size> bytes)`, and
the dump should be listed.

If it fails:

- `didn't find section in config file ("gdrive")`: it ran as root. Run it without `sudo`.
- `Permission denied` on the script: root owns the file. Run the `chown` above, then
  `chmod 700` again.
- `permission denied … docker.sock`: `michael` is not in the `docker` group. Run
  `sudo usermod -aG docker michael`, then log out and in again.

## 2. Schedule it **[SRV]** (once)

Nightly at 04:15 server time, 15 minutes after CV Builder's backup (04:00):

```bash
crontab -e
```

Add this line under the existing ones, then save and exit:

```text
15 4 * * * /home/michael/apps/guests-seating-board/shared/backup-db.sh >> /home/michael/apps/guests-seating-board/shared/backup.log 2>&1
```

Check it with `crontab -l`. The next morning,
`tail /home/michael/apps/guests-seating-board/shared/backup.log` should end with an `ok:` line.

Optional: to be emailed when a night is missed, create a free check at https://healthchecks.io
(period 1 day, grace 2 hours) and put its ping URL in the script's `PING_URL="…"` line.

## 3. Restore drill **[SRV]** (any time)

Do it once now, to know the backups work. It never touches the real database: it restores the
newest dump into a scratch database `guests_restore` next to it, counts the rows that matter,
and drops it again. Paste the block as it is — it picks the newest dump itself:

```bash
docker exec guests-seating-board-postgres-prod sh -c 'dropdb -U "$POSTGRES_USER" --if-exists guests_restore'
FILE=$(rclone lsf gdrive:guests-seating-board-backups --max-depth 1 --include 'guests-*.dump' | sort | tail -n 1); echo "$FILE"
[ -n "$FILE" ] && rclone cat "gdrive:guests-seating-board-backups/$FILE" | docker exec -i guests-seating-board-postgres-prod sh -c 'createdb -U "$POSTGRES_USER" guests_restore && pg_restore -U "$POSTGRES_USER" -d guests_restore --no-owner'
docker exec guests-seating-board-postgres-prod sh -c 'psql -U "$POSTGRES_USER" -d guests_restore -c "select (select count(*) from \"User\") users, (select count(*) from \"GuestList\") lists, (select count(*) from \"Payment\") payments"'
docker exec guests-seating-board-postgres-prod sh -c 'dropdb -U "$POSTGRES_USER" guests_restore'
```

`NOTICE: database "guests_restore" does not exist, skipping` on the first line is normal. The
restore line prints nothing when it works; the counts should match what the site has.

## Real restore **[SRV]** (only after data loss)

⚠ **This replaces the live database** and takes the API down while it runs. To check that the
backups work, use the drill above instead.

First list the dumps and set `FILE` to the one to go back to, keeping the quotes. Dump names are
UTC times:

```bash
rclone lsl gdrive:guests-seating-board-backups --max-depth 1
FILE='guests-YYYY-MM-DDTHHMMZ.dump'
rclone lsf "gdrive:guests-seating-board-backups/$FILE"
```

The last line must print the file name back. If it prints an error, fix `FILE` before going on.
Then take a dump of the current state first, so the restore itself can be undone, and restore:

```bash
/home/michael/apps/guests-seating-board/shared/backup-db.sh
sudo systemctl stop guests-seating-board-api
[ -n "$FILE" ] && rclone cat "gdrive:guests-seating-board-backups/$FILE" | docker exec -i guests-seating-board-postgres-prod sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner'
sudo systemctl start guests-seating-board-api
systemctl is-active guests-seating-board-api
```

The last line should print `active`. To go back to a pre-deploy dump instead, put
`cat /home/michael/apps/guests-seating-board/backups/<file>.dump |` in place of `rclone cat …`.

Everything after the restored dump is undone, which has two consequences to settle by hand:

- **Payments** made since then are gone from the database but not from the bank: put those
  buyers' passes back from the bank's records (`docs/PAYMENTS.md`).
- **Accounts deleted** since then are back. The privacy policy says a deleted account is gone,
  so delete them again.

## Keeping it up

- If `backup-db.sh` changes in the repo, paste it again (empty the file first with
  `truncate -s 0 <path>`). Keep your `PING_URL` value.
- Drive's free 15 GB is shared with the other apps' backups. Lists are small JSON, so these
  dumps stay small; check the usage with `rclone about gdrive:`.
