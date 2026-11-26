# Seminar registration backend

`seminar.html` (opened from **Upcoming events** on the home page) sends each registration to this Google Apps Script web app (`Code.gs`). It is separate from the job application backend in `apps-script/`, so registrations go to their own Google Sheet.

It runs the same checks as the application form (name, Bangladeshi mobile number, email, age 18–60, consent, CV), then:

- rejects a second registration with the same phone number (`DUPLICATE`)
- saves the CV to a private Drive folder named **OPearl Seminar - CVs**
- adds one row to a **Seminar Registrations** tab and returns a Reference ID such as `SM-251111-7K3Q`

## One-time setup

1. Create the new Google Sheet for seminar registrations.
2. **Extensions → Apps Script**. Delete everything in `Code.gs` and paste in this folder's `Code.gs`. Save.
3. Choose **`setup`** in the function dropdown and click **Run**. Approve the permission prompt.
   This creates the `Seminar Registrations` tab with its headers and the CV folder.
4. **Deploy → New deployment** → gear icon → **Web app**: *Execute as* **Me**, *Who has access* **Anyone**. Copy the **Web app URL** (ends in `/exec`).
5. In `seminar.html`, replace `PASTE_YOUR_WEB_APP_URL_HERE` with that URL, then commit and push.

Test it: open the URL from step 4 in a browser. It should show `{"ok":true,"service":"opearl-seminar"}`.

After editing `Code.gs`, use **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy** to keep the same URL.
