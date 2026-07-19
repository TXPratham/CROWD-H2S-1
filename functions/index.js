const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// Staff roster
const staffRoster = [
    { id: 'S01', name: 'Team Alpha',  role: 'waste_crew',    current_zone: 'North Stand', status: 'idle' },
    { id: 'S02', name: 'Team Beta',   role: 'waste_crew',    current_zone: 'South Stand', status: 'active' },
    { id: 'S03', name: 'Team Gamma',  role: 'crowd_control', current_zone: 'East Stand',  status: 'idle' },
    { id: 'S04', name: 'Team Delta',  role: 'crowd_control', current_zone: 'West Stand',  status: 'idle' },
    { id: 'S05', name: 'Team Epsilon', role: 'waste_crew',   current_zone: 'East Stand',  status: 'idle' },
    { id: 'S06', name: 'Team Zeta',   role: 'crowd_control', current_zone: 'North Stand', status: 'active' }
];

// System Prompts
const BIN_PRIORITY_SYSTEM_PROMPT = `You are the Waste Operations AI for a FIFA 2026 stadium.

ROLE: Analyse live waste-bin telemetry and zone-traffic data, then produce a prioritised action list.

INPUTS (provided as JSON in the user message):
  • bins[]:   { bin_id, zone, fill_level (0-100), timestamp }
  • zones[]:  { zone_id, occupancy, capacity, timestamp }

RULES YOU MUST FOLLOW:
1. A bin is CRITICAL when fill_level >= 80 %.
2. A bin is WARNING  when fill_level >= 50 % AND < 80 %.
3. A bin is NORMAL   when fill_level < 50 %.
4. Higher zone-occupancy-% makes a co-located bin more urgent (more people → faster fill).
5. Rank bins by computed urgency = fill_level + (zone_occupancy_pct × 0.3).  Highest first.
6. For each CRITICAL / WARNING bin, write 1-2 sentences of plain-English reasoning that references the ACTUAL bin_id, fill level, zone name, and zone occupancy numbers.  Do NOT write generic/canned text.
7. If no bins are at WARNING or CRITICAL, respond with risk_level "LOW" and a brief all-clear note.

OUTPUT (strict JSON — no markdown fences):
{
  "risk_level": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "priority_order": [
    {
      "bin_id": "<id>",
      "zone": "<zone>",
      "fill_level": <number>,
      "zone_occupancy_pct": <number>,
      "urgency_score": <number>,
      "status": "CRITICAL" | "WARNING" | "NORMAL",
      "reasoning": "<1-2 sentences referencing actual numbers>"
    }
  ],
  "summary": "<2-3 sentence overall situation assessment referencing specific zones & numbers>"
}`;

const STAFFING_SYSTEM_PROMPT = `You are the Staffing Operations AI for a FIFA 2026 stadium.

ROLE: Given a prioritised bin list and the available staff roster, recommend concrete staff reassignments.

INPUTS (provided as JSON in the user message):
  • priority_list: the output of the Bin-Priority AI (same schema).
  • staff[]:  { id, name, role ("waste_crew" | "crowd_control"), current_zone, status ("idle" | "active") }

RULES YOU MUST FOLLOW:
1. Only reassign staff whose status is "idle" (do not pull active staff unless there are zero idle options).
2. Prefer waste_crew for bin emergencies; use crowd_control only as last resort for bins.
3. Minimise travel: prefer staff already in the same zone or an adjacent zone.
4. For crowd-control zone overload (zone_occupancy_pct >= 90), redirect crowd_control staff.
5. Never leave a zone with CRITICAL bins completely unstaffed.
6. Write 1-2 sentences of reasoning per reassignment referencing the staff name, their current zone, and why they should move.  Do NOT write generic/canned text.
7. If no reassignment is needed, say so explicitly.

OUTPUT (strict JSON — no markdown fences):
{
  "reassignments": [
    {
      "staff_id": "<id>",
      "staff_name": "<name>",
      "from_zone": "<zone>",
      "to_zone": "<zone>",
      "task": "bin_collection" | "crowd_redirect" | "standby",
      "reasoning": "<1-2 sentences with specifics>"
    }
  ],
  "crowd_redirects": [
    {
      "from_zone": "<zone>",
      "to_zone": "<zone>",
      "reasoning": "<why redirect spectators>"
    }
  ],
  "summary": "<2-3 sentence overall staffing recommendation>"
}`;

// Local Reasoning Engine
function runLocalReasoning(binInput) {
  console.log('[Reasoning] Running local reasoning pipeline.');
  
  const priorityOrder = binInput.bins.map(b => {
    let status = "NORMAL";
    if (b.fill_level >= 80) status = "CRITICAL";
    else if (b.fill_level >= 50) status = "WARNING";
    
    const urgency = b.fill_level + (b.zone_occupancy_pct * 0.3);
    
    let reasoning = `Bin ${b.bin_id} in ${b.zone} is at normal capacity (${b.fill_level.toFixed(1)}%). No action required.`;
    if (status === "CRITICAL") {
      reasoning = `CRITICAL ALERT: Bin ${b.bin_id} in ${b.zone} has reached ${b.fill_level.toFixed(1)}% fill level. High traffic (occupancy at ${b.zone_occupancy_pct.toFixed(1)}%) requires immediate dispatch for waste collection.`;
    } else if (status === "WARNING") {
      reasoning = `WARNING: Bin ${b.bin_id} in ${b.zone} is currently ${b.fill_level.toFixed(1)}% full. Monitor closely as zone occupancy is ${b.zone_occupancy_pct.toFixed(1)}%.`;
    }
    
    return {
      bin_id: b.bin_id,
      zone: b.zone,
      fill_level: b.fill_level,
      zone_occupancy_pct: b.zone_occupancy_pct,
      urgency_score: parseFloat(urgency.toFixed(1)),
      status: status,
      reasoning: reasoning
    };
  }).sort((a, b) => b.urgency_score - a.urgency_score);

  const criticalCount = priorityOrder.filter(p => p.status === 'CRITICAL').length;
  const warningCount = priorityOrder.filter(p => p.status === 'WARNING').length;
  
  let riskLevel = "LOW";
  let summary = "All waste operations are nominal. Stadium status is clear.";
  if (criticalCount > 0) {
    riskLevel = "CRITICAL";
    summary = `Stadium operations alert: ${criticalCount} bins have crossed the critical threshold (80%). West and South stands are experiencing high waste accumulation. Priority dispatch recommended.`;
  } else if (warningCount > 0) {
    riskLevel = "HIGH";
    summary = `Monitoring stadium waste levels: ${warningCount} bins are in warning state. Refill rates are expected to accelerate due to crowd engagement.`;
  }

  const priorityResult = {
    risk_level: riskLevel,
    priority_order: priorityOrder,
    summary: summary
  };

  const reassignments = [];
  let staffIdx = 0;
  const idleStaff = staffRoster.filter(s => s.status === 'idle');
  
  priorityOrder.filter(p => p.status === 'CRITICAL' || p.status === 'WARNING').forEach(item => {
    if (staffIdx < idleStaff.length) {
      const staff = idleStaff[staffIdx];
      reassignments.push({
        staff_id: staff.id,
        staff_name: staff.name,
        from_zone: staff.current_zone,
        to_zone: item.zone,
        task: "bin_collection",
        reasoning: `Reassign ${staff.name} (currently idle in ${staff.current_zone}) to assist with ${item.status.toLowerCase()} bin ${item.bin_id} in ${item.zone}.`
      });
      staffIdx++;
    }
  });

  const crowdRedirects = binInput.zones.filter(z => {
    const pct = z.capacity > 0 ? (z.occupancy / z.capacity) * 100 : 0;
    return pct >= 90;
  }).map(z => {
    const currentPct = (z.occupancy / z.capacity) * 100;
    return {
      from_zone: z.zone_id,
      to_zone: z.zone_id === 'East Stand' ? 'West Stand' : 'East Stand',
      reasoning: `${z.zone_id} is extremely crowded at ${currentPct.toFixed(1)}% capacity. Redirect spectators to adjacent stands to ease flow.`
    };
  });

  const staffSummary = reassignments.length > 0
    ? `Operational changes implemented. Redirected ${reassignments.length} idle teams to active alerts.`
    : "Staff levels are nominal. Spectator flows are balanced.";

  const staffResult = {
    reassignments: reassignments,
    crowd_redirects: crowdRedirects,
    summary: staffSummary
  };

  return { priorityResult, staffResult };
}

// Groq API client helper using native fetch (Node 18+)
async function callGroq(systemPrompt, userPayload, apiKey) {
  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: JSON.stringify(userPayload)
        }
      ],
      temperature: 0.3,
      max_tokens: 2048,
      response_format: {
        type: "json_object"
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const rawText = data.choices[0].message.content;
  return JSON.parse(rawText);
}

// Database Triggered Cloud Function with Secrets configuration
exports.runAIReasoning = functions
  .runWith({ secrets: ["GROQ_API_KEY"] })
  .database.ref("/stadium_data/bins")
  .onWrite(async (change, context) => {
    const db = admin.database();
    const now = Date.now();
    
    // Rate limiting check (30 seconds)
    const lastRunRef = db.ref("/stadium_data/last_ai_run");
    const lastRunSnapshot = await lastRunRef.once("value");
    const lastRun = lastRunSnapshot.val() || 0;
    
    if (now - lastRun < 30000) {
      console.log(`[Rate Limit] Exiting early. Last run was ${now - lastRun}ms ago.`);
      return null;
    }
    
    // Update timestamp early to lock the execution
    await lastRunRef.set(now);
    console.log("[Reasoning] Executing Cloud Function reasoning pipeline...");

    try {
      // Read bins and zones
      const binsSnapshot = await db.ref("/stadium_data/bins").once("value");
      const zonesSnapshot = await db.ref("/stadium_data/zones").once("value");
      
      const binsVal = binsSnapshot.val();
      const zonesVal = zonesSnapshot.val();
      
      if (!binsVal || !zonesVal) {
        console.log("Missing bin or zone data. Exiting.");
        return null;
      }

      const binsList = Array.isArray(binsVal) ? binsVal : Object.values(binsVal);
      const zonesList = Array.isArray(zonesVal) ? zonesVal : Object.values(zonesVal);

      // Format bin inputs
      const bins = binsList.map(b => {
        const zoneData = zonesList.find(z => z.zone_id === b.zone);
        const pct = zoneData && zoneData.capacity > 0 ? (zoneData.occupancy / zoneData.capacity) * 100 : 0;
        return {
          bin_id: b.bin_id,
          zone: b.zone,
          fill_level: typeof b.fill_level === "number" ? parseFloat(b.fill_level.toFixed(1)) : parseFloat(b.fill_level) || 0,
          zone_occupancy_pct: parseFloat(pct.toFixed(1)),
          timestamp: b.timestamp || new Date().toISOString()
        };
      });

      const zones = zonesList.map(z => ({
        zone_id: z.zone_id,
        occupancy: z.occupancy,
        capacity: z.capacity,
        timestamp: z.timestamp || new Date().toISOString()
      }));

      const binInput = { bins, zones };
      
      let priorityResult;
      let staffResult;
      
      const groqApiKey = process.env.GROQ_API_KEY;
      
      if (groqApiKey) {
        try {
          console.log("[Reasoning] Calling Groq API (Bin Priority)...");
          priorityResult = await callGroq(BIN_PRIORITY_SYSTEM_PROMPT, binInput, groqApiKey);
          
          const staffInput = {
            priority_list: priorityResult,
            staff: staffRoster
          };
          
          console.log("[Reasoning] Calling Groq API (Staffing)...");
          staffResult = await callGroq(STAFFING_SYSTEM_PROMPT, staffInput, groqApiKey);
          
          console.log("[Reasoning] Groq API calls successfully executed.");
        } catch (apiErr) {
          console.error("[Reasoning] Groq API call failed. Falling back to local reasoning:", apiErr);
          const localRes = runLocalReasoning(binInput);
          priorityResult = localRes.priorityResult;
          staffResult = localRes.staffResult;
        }
      } else {
        console.warn("[Reasoning] GROQ_API_KEY secret not available. Falling back to local reasoning.");
        const localRes = runLocalReasoning(binInput);
        priorityResult = localRes.priorityResult;
        staffResult = localRes.staffResult;
      }

      // Write results back to Firebase
      const aiPayload = {
        timestamp: new Date().toISOString(),
        trigger: "Cloud Function Trigger",
        bin_priority: priorityResult,
        staffing: staffResult
      };

      await db.ref("stadium_data/ai_recommendations").set(aiPayload);
      console.log("[Reasoning] Successfully wrote recommendations to Firebase.");

    } catch (error) {
      console.error("[Reasoning] Error in Cloud Function pipeline:", error);
    }

    return null;
  });
