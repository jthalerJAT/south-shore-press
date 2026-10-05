-- 049_rewrite_admin_drafts_2026_10_05.sql
-- ONE-TIME CONTENT CLEANUP of Master Admin Stories drafts (not a schema change).
--
-- Publisher direction 2026-10-05: all drafts rewritten under the new house
-- rules (house_style items 10-14, applied same day): facts verified or cut,
-- no sourcing/attribution to other news outlets, no quotes that exist only
-- in another outlet's reporting, no paragraph titles, no AI-slop
-- constructions, every story makes a point.
--
-- The 35 October drafts resolved into 18 real stories; the desks had posted
-- multiple variants of the same events with mutually inconsistent facts
-- (e.g. 17,000-ft dive in 2 min vs 14,000 ft in 29 sec; 174 vs 182 aboard;
-- knife vs crash axe). Each cluster is merged into one story on the newest
-- row and the redundant rows are deleted. Where variants conflicted, the
-- version attributable to a primary source (UAE attorney general, police,
-- governor's office, FlightRadar24 data) wins; facts that existed only as
-- unattributed or outlet-sourced claims were dropped.
--
-- Run in the Supabase SQL editor. Idempotent: re-running re-applies the
-- same updates; the deletes are already gone.

BEGIN;

-- ===========================================================================
-- FLYDUBAI CLUSTER (was 6 variants) -> main news story on 0b74a1eb
-- ===========================================================================
UPDATE public.admin_stories SET
  headline = $h$UAE Declares FlyDubai Cockpit Attack an Act of Terrorism$h$,
  subline  = $h$Prosecutors say the co-pilot attacked the captain with a crash axe on a Tel Aviv-bound flight; passengers stormed the cockpit and the jet landed safely.$h$,
  body = $b01$The United Arab Emirates has formally declared that a FlyDubai co-pilot who attacked his captain mid-flight on a Tel Aviv-bound jet last week was carrying out an act of terrorism, as new details emerged of the struggle that brought the plane back from a near-fatal dive.

UAE Attorney General Hamad Saif Al Shamsi said the co-pilot "began executing his plan during the flight, attacking the captain inside the flight deck using a crash axe and attempting to take control of the aircraft." It was the first official confirmation of the weapon used. Crash axes are standard cockpit equipment on large commercial aircraft, carried so crews can force their way out in an emergency.

Flight FZ1073 departed Dubai for Tel Aviv on Sept. 30 carrying 174 passengers and eight crew, most of them Israeli citizens, Israeli Prime Minister Benjamin Netanyahu said. About two hours into the flight, the co-pilot attacked Capt. Smit Machchhar, an Indian national, and pushed the aircraft into a steep dive. Tracking data published by FlightRadar24 showed the Boeing 737 Max 8 losing more than 14,000 feet in under half a minute, with vertical-speed readings far outside normal operating ranges, before the crew transmitted a general emergency code.

Machchhar, despite wounds to his head, neck and hands, dragged himself to the cockpit door and forced it open. "I was lying on the floor injured but I told myself to go for one last push to open the door from inside," he said in a video call with Indian Prime Minister Narendra Modi, speaking from his hospital bed. "At one point I realized that if I didn't get up, passengers would lose their lives."

Passengers rushed the cockpit. Netanyahu identified Yaniv Hayun, an Israeli plumber, as the man who pulled the co-pilot off the controls and helped level the aircraft; others bound the attacker with zip ties and headphone cords. Off-duty pilots traveling as passengers then took over and landed the jet at Tabuk Airport in northwestern Saudi Arabia. No passengers were killed.

The co-pilot, an Omani national whom authorities have not publicly named, was taken into custody in Saudi Arabia and later transferred to the UAE. Authorities said his social media accounts contained terrorist imagery, and Netanyahu said preliminary findings indicated he had undergone "Islamist radical indoctrination." After being subdued, the man called out for crew members to kill him, Netanyahu said.

"Investigations are ongoing to establish the full circumstances, motives, and any links related to the incident, as well as to complete technical examinations and analysis of physical and digital evidence," the attorney general's office said.

Machchhar was treated in Tabuk and transferred to Abu Dhabi, where officials said he is recovering. Modi praised him in their call, telling him "the entire country is praying for you." Netanyahu called the captain a "true hero," and President Donald Trump praised the passengers who intervened.

The attack cut the only direct air route between Israel and the UAE still operating during the regional conflict, stranding thousands of Israelis in Dubai. FlyDubai suspended the route, and Israeli carriers began repatriation flights after receiving approvals from Emirati authorities.$b01$,
  updated_at = now()
WHERE id = '0b74a1eb-d361-4e90-99bb-d777e9582a34';

-- Security-failures angle, stripped to officially attributable material
UPDATE public.admin_stories SET
  headline = $h$Netanyahu: Security 'Loophole' Let FlyDubai Attacker Onto Israel-Bound Flight$h$,
  subline  = $h$Investigators in the UAE, Israel and Australia are examining how the co-pilot was cleared to fly the route.$h$,
  body = $b02$The cockpit attack aboard FlyDubai Flight FZ1073 is turning into an international accounting of how an allegedly radicalized co-pilot was cleared to fly an Israel-bound passenger jet at all.

Israeli Prime Minister Benjamin Netanyahu said a "loophole" in security arrangements allowed the co-pilot to be assigned to the route. Israel maintains longstanding arrangements with foreign carriers intended to keep pilots from countries that have no diplomatic relations with Israel off such flights, he said. The co-pilot, an Omani national, nonetheless occupied the right seat of the Sept. 30 flight from Dubai to Tel Aviv, where UAE prosecutors say he attacked the captain with a crash axe and tried to take control of the aircraft before passengers and crew subdued him.

The UAE's attorney general, Hamad Saif Al Shamsi, has formally classified the attack as an attempted terrorist act and said investigators are examining the man's motives, communications and any links to outside groups. Authorities said his social media accounts contained terrorist imagery.

The investigation has reached Australia, where the man studied before becoming a pilot. A spokesperson for the Victorian Joint Counter Terrorism Team confirmed a probe is underway, with counter-terrorism agencies at the federal and state level involved.

In an account of the attack released by Netanyahu's office, Capt. Smit Machchhar said it began when the co-pilot asked to pray in the cockpit, then struck him from behind. "After 4-5 minutes, I felt a heavy blow to the back of my head," Machchhar said. "I realized it wasn't the plane... it was the other guy who was with me in the cockpit." He said he reached the cockpit door with his last strength: "I knew I couldn't let the passengers die."

Aviation security specialists say the case exposes a structural gap in how flight crews are vetted. Background checks and security clearances are set nation by nation, with no binding international standard, and a pilot's license carries no record of terminations or conduct flags from a previous airline. What FlyDubai knew when it hired the co-pilot months before the attack, and why his clearance survived whatever concerns preceded it, is now the central question before investigators in all three countries.

Netanyahu has invited Machchhar and Indian Prime Minister Narendra Modi to a torch-lighting ceremony at Israel's next Independence Day celebration, an honor traditionally reserved for Israeli citizens. Dubai's Crown Prince Sheikh Hamdan bin Mohammed visited the captain in the hospital and said his actions reflected "the highest degrees of courage."$b02$,
  updated_at = now()
WHERE id = 'a6925570-8f74-4a9d-bafd-cf473566d026';

-- ===========================================================================
-- CORNELL CLUSTER (was 5 prosecutor variants + 3 loophole variants)
-- ===========================================================================
UPDATE public.admin_stories SET
  headline = $h$Hochul Names AG James Special Prosecutor in Cornell Rape Case$h$,
  subline  = $h$The governor said she lost confidence in the Tompkins County DA after the accuser's statement to campus police never reached prosecutors intact.$h$,
  body = $b03$Gov. Kathy Hochul has appointed state Attorney General Letitia James as special prosecutor in the Cornell University gang-rape investigation, removing the case from the Tompkins County district attorney after concluding that the information he relied on in declining to prosecute was incomplete.

Hochul issued the executive order Thursday and appeared with James in Manhattan the next morning. "Newly released information continues to raise serious questions about the investigation conducted by the Cornell Police Department and the decision by the Tompkins County District Attorney not to prosecute an alleged sexual assault," she said in a statement, adding that the developments had "undercut my faith, and the public's faith, in the District Attorney's ability to effectively investigate and prosecute the case at this time."

The case centers on allegations by a former student, identified in court papers as Jane Doe, that she was drugged and sexually assaulted by seven members of the Chi Phi fraternity at Cornell's Ithaca campus in October 2024. She reported the assault to campus police in November 2024. Tompkins County District Attorney Matthew Van Houten declined to prosecute that year; he reopened the investigation last month after Doe filed a civil lawsuit in Manhattan Supreme Court against the seven men, the university and the fraternity. None of the men has been criminally charged, and all seven have denied wrongdoing. Attorneys for two of them have rejected the claim that their clients took part in any assault.

Hochul said the account Cornell police forwarded to prosecutors omitted Doe's explicit statement that she had been raped, along with a group-chat screenshot in which one of the alleged assailants invited others to the scene. Van Houten has said the sworn statement his office received did not accuse the men of rape.

Doe's lawsuit contends she was pressured into consuming ketamine, given alcohol and marijuana, and subjected to sexual acts while incapacitated, and that one fraternity member streamed what was occurring to a group chat and solicited others to join.

Under the executive order, James will direct the investigation and may present the case to a grand jury if the evidence warrants. "Every New Yorker deserves to know that when they report a crime, it will be investigated fully and fairly," James said, describing the matter as an active criminal investigation.

Cornell said it supports the governor's decision, and Hochul said the university has agreed to bring in outside attorneys to examine its handling of the initial allegations. Cornell President Michael I. Kotlikoff pledged greater transparency, stronger accountability for Greek organizations and improved sexual assault prevention in a video address to the campus.

Campus records have added to the scrutiny. Cornell police made a drug arrest at the Chi Phi house in the early hours of Oct. 19, 2024 - hours before Doe says she arrived that evening - and a university Title IX hearing document recorded that a person at the fraternity had overdosed on ketamine on or about Oct. 18. The fraternity was not suspended until Nov. 8, 2024, when Doe came forward to campus police.

Some Republican officials have questioned whether James can be impartial, pointing to a social media post in which she expressed sympathy for the accuser before her appointment. Hochul said she has "every confidence" in James. "The young woman at the center of this case deserves to know that every fact will be examined and justice pursued," she said.$b03$,
  updated_at = now()
WHERE id = 'aaffc5c4-568d-4ddb-a159-e8a9e19184a7';

UPDATE public.admin_stories SET
  headline = $h$Cornell Case Fuels Push to Close New York's Intoxication Loophole$h$,
  subline  = $h$Hochul and lawmakers in both parties want the Assembly to pass a long-stalled bill making clear that voluntary intoxication is not consent.$h$,
  body = $b04$The Cornell University rape investigation has revived a years-long push in Albany to close a gap in New York's sexual assault laws that shields defendants when a victim voluntarily consumed drugs or alcohol.

Under current statute, a person is considered "mentally incapacitated" in sexual assault cases only if they ingested drugs or alcohol without their knowledge or consent. Critics say that threshold strips legal protection from victims who drank or used drugs willingly but were too intoxicated to consent to anything that followed.

"If someone is too intoxicated to consent, it should not matter whether they chose to use drugs or alcohol," Gov. Kathy Hochul said at a Manhattan press conference, where she also announced Attorney General Letitia James's appointment as special prosecutor in the Cornell case. "Voluntary intoxication is not a license for sexual assault, or gang rape, period."

Legislation closing the gap has passed the State Senate repeatedly since it was first introduced in 2019, only to stall in the Assembly without a floor vote. State Sen. Nathalia Fernandez sponsors the Senate bill, and Assemblymember Jeffrey Dinowitz carries the companion measure. Both say the Cornell case may finally move it. "This horrific incident might have been the straw that broke the camel's back in terms of moving on this issue," Dinowitz said. He said the criminal defense bar is among the groups opposing the measure.

Support is not confined to Democrats. State Sen. Rob Rolison, a Poughkeepsie Republican who spent 26 years in law enforcement, called on the Assembly to take up the Senate-passed bill. "Had the Assembly acted when the Senate first passed legislation addressing this loophole years ago, prosecutors could have had a stronger law at their disposal when these allegations were first investigated," Rolison said. "Intoxication is not consent." State Sen. Lea Webb, whose district includes Ithaca and who chairs the Senate Women's Issues Committee, said she and other lawmakers plan to introduce legislation targeting the loophole when the session opens in January.

The issue bears directly on the Cornell case. The Tompkins County district attorney cited the intoxication provision in explaining his initial decision not to prosecute, saying the accuser told university police she had knowingly consumed drugs and alcohol before the alleged assault.

Hochul stopped short of endorsing the Fernandez-Dinowitz bill in its current form and has not called the Legislature back ahead of its scheduled January return. Advocates want faster action. "We are urging the governor to get this bill passed without delay," said Jane Manning, a former sex-crimes prosecutor who directs the Women's Equal Justice Project.$b04$,
  updated_at = now()
WHERE id = 'dc2d0641-bec7-4f8c-94fe-0d73ca3f1ab5';

-- ===========================================================================
-- SOUTHAMPTON FIRE (was 2 variants) -> d01e4887
-- ===========================================================================
UPDATE public.admin_stories SET
  body = $b05$A fire late Tuesday night heavily damaged a North Sea home already at the center of a criminal investigation - the same West Neck Road address where police seized roughly 1,000 pounds of marijuana after a home invasion last month.

Southampton Town police said a 911 call reporting a structure fire at 198 West Neck Road came in at about 11 p.m. on Sept. 29. The Southampton, North Sea, Hampton Bays and Bridgehampton fire departments responded and put out the blaze, which left the building with extensive damage. One firefighter suffered minor injuries, fire officials said.

Town detectives and fire marshals are investigating the cause. Police said it is too early to determine whether the fire is connected to the earlier incident at the house, and that any criminal conduct uncovered in the fire investigation will be pursued.

The address first drew police attention on Sept. 17, when officers responded to a 911 call reporting a home invasion shortly before 1 a.m. They found one person with a laceration to the head; the intruders had left before police arrived. Detectives concluded the house had been deliberately targeted. Officers saw a large quantity of marijuana in plain sight and brought in the Suffolk County District Attorney's East End Drug Task Force. A search warrant turned up approximately 1,000 pounds of cannabis, much of it packaged for distribution, police said.

Antonio Velay, 27, of Southampton, the home's sole remaining occupant, was treated for non-life-threatening injuries and charged with first-degree criminal possession of cannabis, a class D felony.

Both the burglary and the fire remain under investigation. Anyone with information is asked to contact Southampton Town police.$b05$,
  updated_at = now()
WHERE id = 'd01e4887-c8a5-428d-a8c2-99e668cd13cf';

-- ===========================================================================
-- MISSING CHILDREN (was 3 variants) -> 1118e948
-- ===========================================================================
UPDATE public.admin_stories SET
  body = $b06$A three-day law enforcement operation concluded Oct. 1 after locating 34 children and teens who had been reported missing across Nassau County, Suffolk County and Queens, Gov. Kathy Hochul announced Friday.

The youths ranged in age from 7 to 18 at the time they were reported missing, and some had been gone for close to 10 years, said Kevin Branzetti, co-founder and chief executive of the National Child Protection Task Force, the nonprofit that helped organize the effort. Of those located, 18 were from Nassau County, 12 from Suffolk County and four from Queens. Another 31 cases from the same region remain open; investigators examined a total of 70 local files.

More than 100 professionals from nearly 40 agencies and organizations worked out of a command center at the Garden City Hotel, cross-checking case files, pursuing leads and sharing intelligence. The operation was co-led by the state Division of Criminal Justice Services Missing Persons Clearinghouse, the Office of Children and Family Services and the National Child Protection Task Force, with support from the State Police. The FBI and the NYPD Missing Persons Squad also took part.

Most of the youths had left home on their own, officials said, though some were found to have been exploited or trafficked. Nassau Police Commissioner Patrick Ryder said the teens his department located ranged from 13 to 18, including a 17-year-old found Thursday night in Manhattan with a known felon. Suffolk County Police Det. Lt. Frank Messana said some of the missing teens were tracked as far as Pennsylvania. Investigators developed leads using cellphone data, social media and facial recognition technology, officials said.

Each located youth was connected with medical care, counseling, clothing, food and safe housing, officials said.

"Finding them is half the battle," Branzetti said at a Friday news conference. "Keeping them is really what we want."

Hochul called the operation part of an ongoing state commitment. "Every missing child deserves our full attention, and every family deserves answers," she said. "Our commitment does not end when a child is located."

The effort was the fourth such operation in New York State in two years. Prior sweeps in Erie County, the Capital Region and Westchester County together located 168 missing young people, Branzetti said. Investigators said roughly half of located minors go missing again at some point, which is why follow-up care is built into the program.$b06$,
  updated_at = now()
WHERE id = '1118e948-ec52-434c-addb-26151df66e9e';

-- ===========================================================================
-- KYIV BRIDGES (was 2 variants) -> 4420bbd4
-- ===========================================================================
UPDATE public.admin_stories SET
  body = $b07$Russian forces struck a second major bridge spanning the Dnipro River in Ukraine's capital Saturday morning, Kyiv Mayor Vitaliy Klitschko said, extending a new phase of Moscow's campaign against the city's infrastructure and upending daily life for the residents who depend on the crossings.

The attack hit the Pivnichnyi, or Northern, Bridge, injuring two people and damaging the road surface and overhead trolleybus wires. Traffic from the left bank to the right bank was blocked, Klitschko wrote on Telegram, adding that emergency services had responded.

The strike came days after the Pivdennyi, or Southern, Bridge was hit multiple times by Russian drones - the first time either span had been targeted since Moscow launched its full-scale invasion in February 2022. The two bridges are the primary connections between the eastern and western halves of the capital, and many residents rely on the metro lines that cross them. After the earlier attacks, car travel and metro service across the Southern Bridge were suspended, snarling movement across the city.

Klitschko convened a crisis meeting of Kyiv's defense council after the initial attacks and described the city as being in a "very dramatic situation" as Russia battered its "critical infrastructure, logistics, housing" and other key facilities.

Moscow said its drones struck the bridges because they were being used to move Ukrainian troops and military supplies. Russian President Vladimir Putin, speaking Thursday at the Valdai foreign policy forum, called the attacks a response to Ukrainian strikes on Russian oil refineries and Black Sea vessels, acknowledging that Kyiv had "got some results" and that Russia lost roughly one percent of its GDP as a consequence. "Now from every direction we're receiving calls 'let's stop.' But they started it," Putin said.

Ukrainian President Volodymyr Zelensky disputed that framing. "They want to destroy our bridges, our data centers, the internet, mobile networks, hospitals, kindergartens, schools, universities - everything," he said in an interview this week. "They want people to flee their cities."

Russia's Foreign Ministry repeated its call for foreign citizens and diplomats to leave Kyiv following the latest strikes. Many embassies remain open and operating in the city.

Fighting continued elsewhere. Russian-installed officials said two people were killed in a Ukrainian attack on the occupied Luhansk region, and one person was killed and ten wounded in a drone strike on the occupied Zaporizhia region. Russia also attacked a Liberian-flagged cargo vessel in the Odesa region, killing one crew member and injuring three others; twelve more were evacuated safely, the Ukrainian Sea Ports Authority said.

Russia has targeted Ukrainian energy and transportation infrastructure every winter since 2022. Officials and analysts described the bridge strikes as an escalation: both Dnipro crossings had been deliberately spared until this week, and hitting them brings the campaign into the heart of the capital rather than the power and heating facilities on its outskirts.$b07$,
  updated_at = now()
WHERE id = '4420bbd4-cc76-41fc-b05d-82d9af404631';

-- ===========================================================================
-- SINGLES - cleanups
-- ===========================================================================

-- Manhasset remains: strip the "Note to editor" paragraph
UPDATE public.admin_stories SET
  body = $b08$Nassau County homicide detectives are investigating skeletal human remains discovered Thursday evening in a wooded area of Plandome Pond Park, police said.

The remains were found near Lindberg Street at about 5:44 p.m. on Thursday, Oct. 1, according to the Nassau County Police Department.

Police opened a homicide investigation after the discovery. No information about the person's identity, how long the remains had been at the park, or the circumstances of the death was released. The investigation is ongoing.$b08$,
  updated_at = now()
WHERE id = 'eb88370c-6b3a-4f9d-a307-10f6c513fa10';

-- Central Islip arson: remove aggregation meta-language
UPDATE public.admin_stories SET
  body = $b09$A Brooklyn man was arrested on arson charges after a house fire in Central Islip that killed two dogs, authorities said.

Roughly 100 firefighters responded to the blaze. Responding officers tried to reach two dogs trapped inside the house but could not get to them in time, police said. Two people were injured; their conditions were not released.

Police did not release the suspect's name, the address of the fire or what led to the blaze, and no motive has been described publicly. The investigation is ongoing.

Anyone with information is asked to contact Suffolk County police.$b09$,
  updated_at = now()
WHERE id = '415e6ed3-e0f8-4730-a8b0-c93f12e387bf';

-- King Kullen: remove "available reports" language, tighten
UPDATE public.admin_stories SET
  body = $b10$King Kullen, the Long Island grocery chain long billed as America's first supermarket, has been acquired by Giunta's Meat Farms, uniting two family-owned grocers with deep roots on the Island.

The deal closed this past week. "We are excited to officially bring together two family-owned LI supermarket companies with deep roots in the communities we serve," Giunta's said in a statement announcing the acquisition.

The sale ends nearly a century of family ownership of a brand that dates to 1930, when Michael J. Cullen opened what he promoted as a new kind of large-scale, self-service food store - the model that gave the chain its "America's first supermarket" tagline.

Giunta's built its reputation on full-service butcher counters and specialty food departments before expanding into full grocery retail, and operates several locations across Long Island. It takes over a King Kullen footprint that has contracted in recent years amid industry consolidation and competition from national discounters and big-box stores.

The companies did not disclose terms, and they have not said how many King Kullen locations will be rebranded or kept, or on what timeline.$b10$,
  updated_at = now()
WHERE id = 'eb6bab34-96f7-4fd9-9fe3-94e789244dbb';

-- Tennessee execution: fix outlet-sourced final graf + soften wording
UPDATE public.admin_stories SET
  body = $b11$A Tennessee death row inmate who would have been the first woman put to death in the state in over two centuries was unconscious on a ventilator Friday at a hospital in the Nashville area, two days after a lethal injection attempt went wrong, her attorneys said.

Christa Pike, 50, received a death sentence in 1996 for the 1995 torture murder of Colleen Slemmer, 19, in Knoxville. Wednesday's execution began to unravel almost from the start. In an emergency court filing, Pike's lawyers said the prison's IV team made at least seven needle attempts to establish intravenous access. One of the needles was bent at a 90-degree angle when it was withdrawn. At one point, Pike herself suggested possible sites on her body where a line might be placed.

Her attorneys contend that prison officials delivered two complete lethal doses of pentobarbital without recognizing that the IV lines had not been properly placed, causing the drug to seep into surrounding tissue rather than enter her bloodstream. The filing describes Pike's arms as "swollen, burned, and blistered" when she arrived at the hospital, consistent with what medical experts identify as the corrosive effects of pentobarbital that escapes a vein.

"She could be heard crying, whimpering, and breathing loudly throughout the procedure," her attorneys wrote. According to the filing, Pike told those present that her arm felt like it was "about to burst open."

Hospital staff are working to clear pentobarbital from her body. Her legal team has submitted an emergency motion asking a state court to compel the Tennessee Department of Correction to preserve all physical, written, and electronic evidence connected to the failed procedure.

Pike's attorneys had alerted state officials months in advance that her medical history - including thrombocytosis, a blood-clotting disorder, and a well-documented pattern of difficult IV access - made serious complications far more probable. Those warnings, they said, were dismissed.

The state's Department of Correction stood by its actions, saying "the protocol does not allow for additional procedures beyond what was carried out." The agency has not publicly explained why the IV lines failed.

Tennessee Gov. Bill Lee suspended all other executions in the state through the end of the year and directed an independent review. The U.S. Supreme Court had earlier turned away two last-minute bids by Pike's attorneys to halt the execution.

Her legal team is urging Lee to commute her sentence to life in prison. Pike was convicted at 18 and would have been the first woman executed in Tennessee since 1820. The failed procedure has renewed scrutiny of lethal injection practices, and of whether prison systems adequately assess medical conditions that can complicate intravenous drug delivery.$b11$,
  updated_at = now()
WHERE id = '12df1d68-b35e-4ff5-9f77-77654954b568';

-- Okinawa Marine arrest: remove the broadcaster-sourced identification
UPDATE public.admin_stories SET
  body = $b12$A U.S. Marine was arrested Sunday on suspicion of murder and robbery in the killing of a Japanese woman whose body was found inside a hotel in Naha, the capital of Okinawa prefecture, Japanese officials said - an incident that drew a sharp diplomatic protest from Tokyo and renewed scrutiny of American military conduct on the island.

Japanese Defense Minister Shinjiro Koizumi identified the suspect as Lance Cpl. Devin Jacob Ballard, 20, stationed at Marine Corps Air Station Futenma, several miles outside Naha. The woman was pronounced dead at the scene. Ballard denied the allegations, according to police.

Okinawa Prefectural Police were investigating the case as a murder. Police said Ballard was also suspected of taking the victim's wallet and backpack.

Japanese Prime Minister Sanae Takaichi said her government had filed a formal complaint with the United States. "The occurrence of such an extremely brutal and heinous incident is a matter of profound regret, and as the Government of Japan, we have lodged a strong protest with the U.S. side," she said.

Japan's Ministry of Foreign Affairs summoned U.S. Ambassador George Glass on Sunday to deliver the protest in person. Foreign Minister Toshimitsu Motegi demanded that Washington tighten discipline and take concrete steps to prevent similar incidents. Glass said he had spoken with the ministry and with Okinawa's governor and pledged full cooperation with the investigation.

The U.S. Embassy in Tokyo confirmed awareness of the case. "The United States Government continues to cooperate closely with the Government of Japan and local authorities," the embassy said in a statement.

The III Marine Expeditionary Force, headquartered in Okinawa, said it was cooperating with Japanese authorities and extended condolences to the victim's family. "The Marine Corps takes these allegations very seriously and expects every Marine to adhere to the highest standards of behavior," the force said. The Pentagon referred questions to the Marines' statement.

Approximately 18,000 U.S. Marines are based in Japan, the large majority in Okinawa, an island roughly 60 miles from Taiwan at its nearest point. Tens of thousands of U.S. troops in total are stationed across the country under the bilateral defense arrangement.

The American military presence in Okinawa has long generated local friction. A 1995 assault on a 12-year-old girl by three American servicemen sparked mass protests and forced Washington and Tokyo into negotiations over the U.S. footprint on the island. Sunday's arrest risks reopening those tensions at a sensitive moment for the alliance.$b12$,
  updated_at = now()
WHERE id = 'b5960d88-c2b3-4fd7-96e7-34a9de392787';

-- RAF Fairford bombers: light de-slop
UPDATE public.admin_stories SET
  body = $b13$The U.S. Air Force has pulled every bomber stationed at RAF Fairford in Gloucestershire, England, returning them to home bases in the United States after American commanders received fresh threat intelligence tied to a suspected Iranian plot against the installation.

A Pentagon spokesperson confirmed the withdrawal Sunday, saying operational security had prevented real-time disclosure of the movements. "While operational security precluded us from confirming the movement of our assets and forces in real-time, we can acknowledge now that all US bombers that were deployed to RAF Fairford have re-deployed to their home stations in the United States," the spokesperson said.

At least 10 of roughly a dozen B-1 bombers at the base departed Sunday, including several that had arrived on routine rotation within the prior week - a sign of how urgently commanders treated the threat. One U.S. official told reporters the new intelligence was connected to threat warnings that had surfaced three weeks earlier, but that specific details and the sense of urgency had spiked sharply within the prior 24 hours.

The withdrawal followed a Sept. 27 arrest of five British men, all London-based nationals in their 20s, on suspicion of explosives and terrorism offenses near the base. Police recovered a quantity of gasoline in three vans connected to the suspects but found no explosive devices. All five were released on bail.

Days later, British police arrested a 25-year-old dual U.K.-Iranian national in London on suspicion of plotting an attack on the airbase. He too was subsequently released on bail. Counter Terrorism Policing's senior national coordinator, Vicki Evans, said investigators were examining "all possible angles - including possible foreign state involvement."

Iran has denied any connection to the alleged plot and summoned the British ambassador in Tehran to protest the arrests.

President Trump praised British law enforcement's handling of the initial detentions. "The arrest in the UK was fantastic. Working with Britain - it was an amazing job," Trump said, adding that the suspects had been under surveillance for some time.

RAF Fairford, roughly 100 miles west of London, has served as a staging ground for American air power in Middle East conflicts since the 1991 Gulf War. Its most recent use came after the prior British government granted Washington access to several U.K. bases for operations against Iran following the start of the current conflict in late February.

The Pentagon said the redeployment does not reduce American strike capability. "The Airmen that operate America's bomber force, including B-1s, B-2s, and B-52s, remain ready to deliver precision global strike capabilities - including through operations that launch and recover from the continental United States - anywhere, anytime," the spokesperson said.

Separately, the U.S. military has been building up naval strength in the Middle East. A U.S. official confirmed Thursday that the USS Theodore Roosevelt carrier strike group and the USS Makin Island amphibious ready group - carrying more than 7,000 sailors and roughly 2,000 Marines - were heading toward the region, potentially placing three carrier groups there by late October.$b13$,
  updated_at = now()
WHERE id = 'e3dac0cf-9169-4dc6-b1c1-340e258e95d6';

-- ===========================================================================
-- ROARK COLUMNS: de-slop; the two Accenture/Micron columns merge into one
-- ===========================================================================
UPDATE public.admin_stories SET
  subline = $h$When a consulting giant posts its best earnings day in a decade and a chip maker is sold out through next year, the AI spending story is no longer a forecast. It is a bill.$h$,
  body = $b14$Two numbers from this week deserve to be read together, because together they amount to a verdict on how real the AI buildout is. Micron's latest quarter beat expectations again, with management saying more than three-quarters of next year's output is already spoken for and giving no clear sense of when supply catches up with demand. In the same stretch, Accenture posted its strongest earnings reaction in more than ten years, driven by over 400 new AI-related client engagements and a threefold jump in bookings tied to emerging AI partnerships.

Those two stories are the same story told from opposite ends of the supply chain. Accenture gets paid to install AI inside companies that have finally decided to stop pilot-testing and start spending. Micron gets paid because every one of those installations needs memory, and memory has become the chokepoint nobody planned for. DRAM contract prices are up more than 20% this quarter alone and roughly sixfold over the past year, driven overwhelmingly by AI data center buildouts rather than phones or laptops - which is exactly why the price spike has been easy for ordinary consumers to miss until now.

The mechanism is straightforward. Training and running large AI models requires enormous amounts of high-bandwidth memory packed next to the processor, and chipmakers have been racing to repurpose manufacturing capacity toward that higher-margin product. That capacity used to go into the memory chips inside everyday electronics. Toshiba just announced plans to roughly double its data-center hard drive production by 2027, explicitly citing the AI memory gap, which tells you the industry expects the shortage to persist well beyond a quarter or two.

What ties this to a household budget is less obvious but real. Memory shortages that originate in AI data centers raise the input costs for every laptop, smartphone, car and appliance with a chip in it. Corporate America is paying up for AI tools through consultants like Accenture, and paying up again for the hardware those tools require, and both costs eventually surface - with a lag - in the prices of things a Long Island household buys. Any Suffolk County business that budgeted for new computers, servers or point-of-sale systems this fall should expect quotes shaped by a global memory crunch that has nothing to do with local conditions, and would do well to lock in prices sooner rather than later.

A year ago, skeptics could reasonably argue that AI spending was mostly slideware and investor enthusiasm. That argument is harder to sustain when a memory maker is sold out through next year and a consulting firm is reporting its best quarter in a decade on signed contracts. The capital spending cycle has moved from theoretical to physical, and the bill is already circulating.$b14$,
  updated_at = now()
WHERE id = '4ba674d4-886d-4737-9fc7-7ab9fa04c05d';

UPDATE public.admin_stories SET
  headline = $h$Washington Moves to Cut the Cost of the Mortgage Credit Check$h$,
  subline  = $h$Ending the three-bureau credit pull is sold as pro-competition. The question is what it changes for a buyer standing in a Massapequa open house.$h$,
  body = $b15$The Federal Housing Finance Agency moved this week to direct Fannie Mae and Freddie Mac toward requiring lenders to pull credit data from two bureaus instead of three. The shift landed on top of an already-moving story: the agency's director has spent the fall trying to force FICO and its rivals to compete on price rather than operate as a quiet duopoly inside every mortgage closing in America.

The mechanics matter more than the press release suggests. Right now almost every conventional mortgage application triggers a "tri-merge" credit report, pulling files from Equifax, Experian and TransUnion, then running them through a FICO scoring model that lenders are required to use. Cutting that to two bureaus sounds small, but credit bureau stocks dropped on the news anyway, because fewer required pulls means fewer paid pulls, and the bureaus and FICO have built a business on a mandate as much as a product.

Whoever wins the fight, the timing is awkward. The average 30-year mortgage rate sits at its highest level since late 2023, somewhere north of 7.3%. A borrower on the South Shore already absorbing that rate shock will not notice a few dollars shaved off a credit report fee. The regulatory fight is about billions in compliance costs buried inside the mortgage process, and conflating that with the rate itself does buyers no favors.

There is a second layer worth separating out: the scoring-model fight is different from the bureau-count fight, even though they are being covered together. FICO has resisted competition from newer scoring models for years, in part because lenders, investors and regulators all built their risk infrastructure around one number. A regulator forcing a second scoring option into the market is the bigger structural change, because it touches how every mortgage-backed security gets priced, not just how much a loan file costs to assemble.

For Suffolk County, the practical upshot is modest in the short run. Local lenders will not pass through meaningful savings overnight, and a $50 discount on closing costs does little against a rate environment that has added hundreds of dollars a month to the typical payment versus two years ago. What this does set up, slowly, is a credit-scoring market less locked-in than it has been in decades - which over a longer horizon could matter most for first-time buyers with thin credit files.

The cynical read, and it is hard to resist, is that a regulator picking fights with credit bureaus during a housing affordability crunch is cheaper and more visible than moving the 7.3% rate. Breaking up a duopoly photographs well. It does nothing to the 10-year Treasury and builds no houses. Long Island buyers should watch this story for what it is: a plumbing fix, while the real cost pressure stays in the price of the water.$b15$,
  updated_at = now()
WHERE id = 'cf70afcf-8d0d-46b3-a042-bdb92d572e4f';

-- ===========================================================================
-- DELETE the superseded duplicate variants (merged above)
-- ===========================================================================
DELETE FROM public.admin_stories WHERE id IN (
  '063ed4da-2d87-485a-b046-b42f1c507d01', -- FlyDubai variant 1
  'bf56f947-0f72-49f0-9978-b7b74df2170e', -- FlyDubai variant 2
  '634ea732-b2c4-4ca1-8f2b-d72ae20ef7e5', -- FlyDubai variant 3
  'eb2379f0-5f66-4329-9e3d-db1143980b42', -- FlyDubai variant 4
  '6e1450a0-f0b0-4035-b197-8c755dd4c73f', -- FlyDubai variant 5
  'ff298d72-ad29-4889-8b5e-9371b9bd57cf', -- Booker shooting variant (merged earlier)
  '82a4c65f-342b-4c87-89e8-45128f70bcc5', -- Southampton fire variant
  'b0b82f26-f334-4329-b68e-ea043fcd53ae', -- Cornell prosecutor variant 1
  'f9e1c6d7-fd22-4c5d-b3c3-9ef767a75cdd', -- Cornell prosecutor variant 2
  'e0500962-7db1-4d73-8def-ecbe41d02ade', -- Cornell prosecutor variant 3
  '91c80120-1a32-4232-bab0-9f301f614aef', -- Cornell prosecutor variant 4
  '8734bb12-5ac6-409c-81df-cc6c1955ff15', -- Loophole variant 1
  'de239916-971e-449d-a91a-e876ae48ac3b', -- Loophole variant 2
  'dfbe26aa-1db3-4c68-b851-e21db847c62f', -- Missing children variant 1
  '3b711be2-22b6-4995-abef-efd7de2d6dbb', -- Missing children variant 2
  'f0fc00aa-c746-4a7a-a23a-1d585a027620', -- Kyiv bridges variant
  '9fb54266-23cb-4989-8e76-dae7918e9c8d'  -- Roark Accenture column (merged into chips column)
);

COMMIT;

-- Sanity (expect 18 rows, one per story):
-- SELECT headline, byline, created_at::date FROM admin_stories WHERE status='admin_draft' ORDER BY created_at;
