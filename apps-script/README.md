# Application form backend

`application.html` sends each application to a Google Apps Script web app (`Code.gs`). The script:

- checks the data again on the server: job category, name, Bangladeshi mobile number, email, age 18–60 and consent
- rejects a second application with the same phone number for the same job category (`DUPLICATE`)
- saves the CV, if one was uploaded, to a private Drive folder named **OPearl Applications - CVs**
- adds one row to an **Applications** tab in your Google Sheet, and returns a Reference ID such as `OP-251111-7K3Q`

The site itself stores nothing; GitHub Pages only serves the form.

## One-time setup (about 5 minutes)

1. Open the Google Sheet where the applications should go.
2. **Extensions → Apps Script**. Delete everything in `Code.gs` and paste in this folder's `Code.gs`. Save.
3. In the function dropdown at the top, choose **`setup`** and click **Run**. Approve the permission prompt (the script needs your Sheet and Drive).
   This creates the `Applications` tab with its headers and the CV folder in your Drive.
4. **Deploy → New deployment** → gear icon → **Web app**:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
   Click **Deploy** and copy the **Web app URL**. It ends in `/exec`.
5. In `application.html`, replace `PASTE_YOUR_WEB_APP_URL_HERE` with that URL, then commit and push.

Test it: open the URL from step 4 in a browser. It should show `{"ok":true,"service":"opearl-applications"}`.

## Changing the script later

After you edit `Code.gs`, use **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.
This keeps the same URL. **Deploy → New deployment** creates a *new* URL, which `application.html` would then need.

## Notes

- **Status** starts as `New` on every row. Use it to track your follow-up (Contacted, Interviewed and so on).
- CV files are private to the account that deployed the script. The **CV** column links to each file.
- Times are in Bangladesh time (Asia/Dhaka).
- If someone fills in the hidden `website` field (a bot trap), the script shows success but saves nothing.
