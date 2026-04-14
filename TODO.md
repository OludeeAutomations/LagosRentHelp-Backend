# Task: Fix CORS Error on /api/properties

## Steps:

- [x] Create TODO.md with plan breakdown
- [x] Edit api/server.js: Loosen CORS to origin: true + add debug logging
- [x] Test changes locally (npm run dev)
- [x] Commit & push changes (git add . && git commit -m "fix: loosen CORS + add logging for debug" && git push)
- [ ] Check Render deployment logs for startup success/error
- [ ] Test frontend API call
- [ ] Tighten CORS if working (add backend logging endpoint if needed)
- [ ] attempt_completion

Update the backend user/admin profile-image behavior to match this frontend rule set:

1. Only users with role `admin` or `super_admin` are allowed to upload or update `avatar` / profile picture.
2. For `user` and `agent` roles:
   - reject or ignore any incoming `avatar` field on profile update endpoints
   - do not allow avatar changes through `/users/profile` or similar endpoints
3. For admin creation (`POST /users/admins`):
   - `avatar` should remain optional
   - if no avatar is provided, the admin account should still resolve to the company logo as its display image
4. For admin and super admin reads (`/auth/login`, `/auth/validate`, `/users/profile`, `/users/admins`, and any user serialization used by the UI):
   - if `avatar` exists, return it
   - if `avatar` is empty and role is `admin` or `super_admin`, return a computed fallback image using the company logo
   - preferred response shape:
     - keep raw `avatar` as stored value
     - add `displayAvatar` (or `profileImage`) as the fully resolved image the frontend should render
5. For non-admin roles:
   - do not inject the company logo as a fallback profile picture
   - let the frontend fall back to initials/default UI when `avatar` is empty
6. Keep the role checks centralized in middleware/service logic so the rule is enforced consistently across create, update, login, and fetch flows.
