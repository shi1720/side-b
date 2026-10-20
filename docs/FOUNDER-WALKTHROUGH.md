# Side B demonstration script

The generated narration lasts 2 minutes 28.6 seconds. With a short opening or closing frame, target a final video of about 2 minutes 35 seconds. The voice is Google Cloud Text-to-Speech en-US-Chirp3-HD-Charon at a speaking rate of 0.90. Qloo is pronounced “clue” in synthesis and spelled Qloo in captions.

The recording should show the application at https://sideb-records.web.app. Keep the product and video free of event references. Use actual on-screen results. No financial amount, score, selected artist, or result count is hardcoded into the narration.

## Verbatim narration

Some records sit on a shop's shelf for months. Their next listener might already be nearby, connected by a film, a book, or an artist they love.

I'm Shivam Gupta. I built Side B to help independent record shops find those connections and turn them into something they can sell.

This is a private sample shop. The releases are real; the stock and prices are illustrative. A shopkeeper can import their own stock, including costs that stay private.

Let's start with a customer who loves the film Past Lives. I select its exact Qloo match, then set the shop's limits: collection size, price per record, minimum gross margin, and cultural rank fit. I can also give older stock a second spin.

Side B verifies the audience, resolves the stocked artists, and asks Qloo for cultural affinities restricted to those artists. Its planner checks the business rules and selects at most one record per artist.

Here is the shop edit. Each choice comes from available inventory.

Opening “Why this record” shows the Qloo evidence, the artist's position in the candidate pool, and when that evidence was fetched. Rank fit is relative. It is not a prediction that someone will buy, and artist affinity does not prove a particular album will suit them.

I can inspect the decision trail and see why other records were excluded. The financial view shows gross profit if one copy of each selection sells, before tax, fees, and overhead. The baseline comparison makes the cultural input visible.

Now I review the title and story, then publish the edit.

This is the customer's page. It shows current availability and pickup details. I'll reserve one copy using a test name. The hold is free, lasts forty-eight hours, and gives me a pickup reference. No payment happens here, and this sample does not reserve a physical record.

Back in the shop workspace, that hold appears. Cancelling it restores the available copy. Marking a hold collected records the counter outcome instead.

The business is a focused weekly merchandising tool for independent shops. My next step is a retailer pilot measuring preparation time, collected holds, and gross contribution. Pricing and commercial results still need validation.

Qloo supplies the cultural connection. Side B gives the shopkeeper an edit they can inspect, publish, and manage.

## Screen choreography

| Voice track time | Show and do |
|---|---|
| 0:00 to 0:16.5 | Studio hero. Show the sample-shop label during the introduction. |
| 0:16.5 to 0:28 | Your inventory. Show artist, title, price, cost, quantity, and CSV controls. Return to the studio. |
| 0:28 to 0:44.5 | Search Past Lives, choose the exact film, then show commercial controls and the older-stock preference. |
| 0:44.5 to 0:58.2 | Click Build my shop edit. Show the real processing state, then use a visible cut past the wait if necessary. |
| 0:58.2 to 1:02.5 | Reveal the actual returned collection. |
| 1:02.5 to 1:19.3 | Expand Why this record. Point to its source, rank, and timestamp. |
| 1:19.3 to 1:35 | Expand the decision trail and one exclusion. Show the gross profit scenario and baseline comparison. |
| 1:35 to 1:38.5 | Review the editable title and story. Publish the shop edit. |
| 1:38.5 to 1:57 | Open the customer page. Show sample disclosure and pickup instructions. Hold one available record using Demo Listener. Show its reference. |
| 1:57 to 2:07.3 | Return to Campaigns and refresh the holds. Cancel the demonstration hold. Show available stock restored. |
| 2:07.3 to 2:21.4 | Show the studio while describing the buyer and proposed retailer pilot. |
| 2:21.4 to 2:28.6 | Closing frame: Side B, https://sideb-records.web.app, and “Created by Shivam Gupta.” |


These timings follow the generated voice track. The per-paragraph timing and caption map are saved in work/video/scenes.json. Let the speech and actual interactions set the cuts. A longer real API wait can be shortened with a visible cut; do not fabricate a response or replace errors with staged success. Keep the Qloo evidence legible for several seconds.

## Generated audio and captions

- Voice track: SIDE-B-VOICEOVER.mp3
- Captions: SIDE-B-CAPTIONS.srt
- Thirteen measured paragraph scenes, with no inserted artificial gaps.
- Captions retain original narration spelling and use estimated timings within each measured paragraph. Review against the final edit.
- Audio checks found no clipped samples or silent interval of half a second or longer.

## Preparation

1. Open a fresh sample workspace in a clean browser session. Close unrelated tabs and hide personal browser details.
2. Confirm that the deployed application can search Past Lives, generate a collection, publish it, create a hold, and cancel it.
3. Record the starting quantity for the record used in the hold. Confirm one fewer available after holding and the starting quantity after cancellation.
4. Keep the sample disclosure visible in the customer sequence. Do not imply a real shop or physical fulfillment.
5. Record at 1920 by 1080 if available. Use a readable browser zoom and a calm cursor. Capture the application without developer tools or terminal windows.
6. Use a natural, clear voice with modest variation. Leave short pauses before opening evidence and revealing the pickup reference. Avoid a sales-announcer delivery.
7. Match captions to the final audio. Use sentence case, at most two lines at once, and enough screen time to read each caption. Keep captions away from the evidence and reference number. Correct “Qloo” and artist names manually.
8. Recheck every shot against the final deployed app. If the interface changes, update the choreography rather than narrating controls that no longer exist.

## Closing frame copy

Side B  
Your best unsold record hasn't met its listener yet.  
https://sideb-records.web.app  
Created by Shivam Gupta
