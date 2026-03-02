import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Expire overdue licenses
    const { data: expiredCount, error: expireError } = await supabase.rpc(
      "expire_overdue_licenses"
    );

    if (expireError) {
      console.error("Error expiring licenses:", expireError);
    } else {
      console.log(`Expired ${expiredCount} overdue licenses`);
    }

    // 2. Send renewal reminder notifications (7 days before expiry)
    let remindersSent = 0;
    try {
      // Find licenses expiring within 7 days that are still ACTIVE
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const { data: expiringLicenses, error: fetchError } = await supabase
        .from("developer_licenses")
        .select("id, orgName, expiryDate, ownerId, organization_id, renewal_alert_days")
        .in("status", ["ACTIVE", "TRIAL"])
        .not("expiryDate", "is", null)
        .not("ownerId", "is", null)
        .lte("expiryDate", sevenDaysFromNow.toISOString())
        .gt("expiryDate", new Date().toISOString());

      if (fetchError) {
        console.error("Error fetching expiring licenses:", fetchError);
      } else if (expiringLicenses && expiringLicenses.length > 0) {
        for (const license of expiringLicenses) {
          const expiryDate = new Date(license.expiryDate);
          const now = new Date();
          const daysLeft = Math.ceil(
            (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );

          // Check if we already sent a notification for this license today
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);

          const { data: existingNotif } = await supabase
            .from("user_notifications")
            .select("id")
            .eq("user_id", license.ownerId)
            .eq("type", "renewal_reminder")
            .gte("created_at", todayStart.toISOString())
            .limit(1);

          if (existingNotif && existingNotif.length > 0) {
            // Already notified today, skip
            continue;
          }

          // Format expiry date for display
          const formattedDate = expiryDate.toLocaleDateString("ar-SY", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });

          const daysText =
            daysLeft === 1
              ? "يوم واحد"
              : daysLeft === 2
              ? "يومين"
              : `${daysLeft} أيام`;

          // Insert notification for the owner
          const { error: notifError } = await supabase
            .from("user_notifications")
            .insert({
              user_id: license.ownerId,
              title: `⚠️ اشتراك ${license.orgName} ينتهي خلال ${daysText}`,
              description: `ينتهي اشتراكك في ${formattedDate}. يرجى تجديد الاشتراك عبر شام كاش لتجنب توقف الخدمة.`,
              type: "renewal_reminder",
              data: {
                license_id: license.id,
                organization_id: license.organization_id,
                days_left: daysLeft,
                expiry_date: license.expiryDate,
              },
            });

          if (notifError) {
            console.error(
              `Error sending reminder for license ${license.id}:`,
              notifError
            );
          } else {
            remindersSent++;
            console.log(
              `Sent renewal reminder to owner ${license.ownerId} for ${license.orgName} (${daysLeft} days left)`
            );
          }
        }
      }
    } catch (reminderErr) {
      console.error("Error in renewal reminders:", reminderErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        expired_count: expiredCount ?? 0,
        reminders_sent: remindersSent,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
