# LightShop: secure API, admin panel, deliveries and roles

## 1. Database (Supabase -> SQL Editor)
Run `supabase/roles_stock_delivery.sql`. (Run the earlier `barcode_and_learning.sql` first if you have not.)

## 2. Turn OFF public sign-ups  (important for safety)
Supabase dashboard -> Authentication -> Sign In / Providers -> turn off "Allow new users to sign up".
Only the admin creates users from the app.

## 3. Deploy the admin-only user API
In your old `lightshop` folder (the one linked to Supabase), copy `supabase/functions/admin-users/` into it, then:
supabase functions deploy admin-users

## 4. Copy app files into LightShopApp (replace when asked)
lib/ (types.ts, auth.tsx, api.ts, ui.ts), components/ (Chips.tsx, Sheet.tsx),
screens/ (Admin, Stock, Deliveries, NewDelivery, DeliveryDetail, Users .tsx), src/BottomStack, src/MainStack.

## 5. Reload
No new native library: just reload the app (shake -> Reload, or press R twice in Metro).
Log out and log in again so the role is loaded.
