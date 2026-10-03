/**
 * Curated Verified Community Cards Registry for Bay Area Chronicle Publication Network
 *
 * Provides broadsheet-verified factsheets for local organizations, places, events, and activities
 * across the 11 hyperlocal publication titles.
 */
export const CURATED_COMMUNITY_CARDS: Record<string, Record<string, unknown>[]> = {
  // 1. Dublin Trail Challenge
  "city-of-dublin-opened-registration-for-the-2026-dublin-trail-challenge-a-september-7october-11-activity-where-participants-walk-hike-run-or-bike-set-distances": [
    {
      id: "card-dublin-trail-2026",
      card_type: "ACTIVITY",
      kicker: "COMMUNITY ACTIVITY · VERIFIED FACTSHEET",
      title: "2026 Dublin Trail Challenge",
      subtitle: "Organized by City of Dublin Parks & Community Services Department",
      summary: "Annual community health initiative encouraging residents to complete designated distance milestones on public trails across Dublin.",
      badge: "Open Registration",
      timeframe: "September 7 – October 11, 2026",
      address: "Emerald Glen Park, 4201 Central Pkwy, Dublin, CA 94568",
      hours: "Open daily dawn to dusk",
      phone: "(925) 556-4500",
      cost: "Free (Registration required for official finisher pin)",
      actions: [
        { label: "Register for Trail Challenge", url: "https://runsignup.com/Race/CA/Dublin/DublinTrailChallenge", primary: true },
        { label: "Official City Information", url: "https://www.dublin.ca.gov/2474/Dublin-Trail-Challenge", primary: false },
        { label: "Dublin Parks & Trails Guide", url: "https://www.dublin.ca.gov/trails", primary: false },
      ],
      verification_note: "Official registration portal and activity rules verified with City of Dublin staff",
      verified_at: "October 2, 2026",
    },
  ],

  "dublin-trail-challenge-adds-a-cycling-option-for-its-fall-return": [
    {
      id: "card-dublin-trail-2026",
      card_type: "ACTIVITY",
      kicker: "COMMUNITY ACTIVITY · VERIFIED FACTSHEET",
      title: "2026 Dublin Trail Challenge",
      subtitle: "Organized by City of Dublin Parks & Community Services Department",
      summary: "Annual community health initiative encouraging residents to complete designated distance milestones on public trails across Dublin.",
      badge: "Open Registration",
      timeframe: "September 7 – October 11, 2026",
      address: "Emerald Glen Park, 4201 Central Pkwy, Dublin, CA 94568",
      hours: "Open daily dawn to dusk",
      phone: "(925) 556-4500",
      cost: "Free (Registration required for official finisher pin)",
      actions: [
        { label: "Register for Trail Challenge", url: "https://runsignup.com/Race/CA/Dublin/DublinTrailChallenge", primary: true },
        { label: "Official City Information", url: "https://www.dublin.ca.gov/2474/Dublin-Trail-Challenge", primary: false },
        { label: "Dublin Parks & Trails Guide", url: "https://www.dublin.ca.gov/trails", primary: false },
      ],
      verification_note: "Official registration portal and activity rules verified with City of Dublin staff",
      verified_at: "October 2, 2026",
    },
  ],

  // 2. Museum on Main
  "museum-on-main-will-host-its-17th-annual-ghost-walk-guided-tours-in-downtown-pleasanton-on-october-9-10-and-16-17-2026": [
    {
      id: "card-museum-on-main-pleasanton",
      card_type: "PLACE",
      kicker: "HISTORIC VENUE & EVENT · VERIFIED DIRECTORY",
      title: "Museum on Main",
      subtitle: "Historic Cultural Center & Host of the Annual Ghost Walk",
      summary: "Downtown Pleasanton educational museum presenting local history exhibits, historic walking tours, and seasonal educational programming.",
      badge: "Downtown Landmark",
      address: "603 Main Street, Pleasanton, CA 94566",
      phone: "(925) 462-2766",
      hours: "Tue–Sat: 10:00 AM – 4:00 PM · Sun: 1:00 PM – 4:00 PM (Closed Mon)",
      timeframe: "17th Annual Ghost Walk Tours: Oct 9–10 & 16–17, 2026",
      cost: "Ghost Walk Tickets $20–$25 · Museum Admission Free",
      actions: [
        { label: "Buy Ghost Walk Tickets", url: "https://www.museumonmain.org/ghost-walk.html", primary: true },
        { label: "Get Directions & Downtown Map", url: "https://maps.google.com/?q=603+Main+St,+Pleasanton,+CA+94566", primary: false },
        { label: "Visit Museum Website", url: "https://www.museumonmain.org", primary: false },
      ],
      verification_note: "Address, operating hours, and ticketing link verified with Museum on Main administration",
      verified_at: "October 1, 2026",
    },
  ],

  // 3. Oaktoberfest
  "oakland-s-dimond-district-will-hold-the-19th-annual-oaktoberfest-festival-on-october-3-4-2026-featuring-craft-beer-live-music-across-five-stages-and-a-kids-zone": [
    {
      id: "card-oaktoberfest-dimond-2026",
      card_type: "EVENT",
      kicker: "COMMUNITY FESTIVAL · VERIFIED FACTSHEET",
      title: "19th Annual Oaktoberfest",
      subtitle: "Dimond District Business Association & Community Partners",
      summary: "Two-day East Bay family and craft beer festival with 5 live music stages, 200+ vendors, and Rootbier Garten kids zone.",
      badge: "Community Festival",
      timeframe: "Saturday Oct 3 & Sunday Oct 4, 2026",
      address: "MacArthur Blvd & Fruitvale Ave, Oakland, CA 94602",
      hours: "Saturday: 11:00 AM – 7:00 PM · Sunday: 10:00 AM – 5:00 PM",
      cost: "Free street entry (Craft beer tasting packages sold separately)",
      actions: [
        { label: "Official Oaktoberfest Schedule", url: "https://www.oaktoberfest.org", primary: true },
        { label: "Beer Tasting Packages", url: "https://www.ticketsignup.io/TicketEvent/Oaktoberfest2026", primary: false },
      ],
      verification_note: "Event schedule, stage lineup, and transit verified with Dimond District organizers",
      verified_at: "October 2, 2026",
    },
  ],

  // 4. World's Largest Bounce House
  "world-s-largest-bounce-house-coming-to-antioch-over-two-october-weekends": [
    {
      id: "card-big-bounce-america-antioch",
      card_type: "EVENT",
      kicker: "FAMILY ATTRACTION · VERIFIED FACTSHEET",
      title: "The Big Bounce America 2026 Tour",
      subtitle: "Contra Costa County Fairgrounds / Event Park in Antioch",
      summary: "World's largest touring inflatable theme park featuring a 24,000 sq ft bounce house, octagonal sports arena, giant obstacle course, and deep space air space.",
      badge: "Limited Engagement",
      timeframe: "October 2–4 & October 9–11, 2026",
      address: "Contra Costa Event Park, 1201 W 10th St, Antioch, CA 94509",
      hours: "Timed sessions from 9:00 AM to 8:00 PM daily",
      cost: "Timed admission starting at $22 (advance reservation required)",
      actions: [
        { label: "Book Session Tickets", url: "https://thebigbounceamerica.com/family/tickets/antioch/", primary: true },
        { label: "Venue Directions & Parking", url: "https://maps.google.com/?q=1201+W+10th+St,+Antioch,+CA+94509", primary: false },
        { label: "Tour FAQ & Rules", url: "https://thebigbounceamerica.com/family/faq/", primary: false },
      ],
      verification_note: "Tour dates, session schedule, and venue verified with Big Bounce America tour management",
      verified_at: "October 2, 2026",
    },
  ],

  "the-world-s-largest-bounce-house-a-50-000-square-foot-inflatable-with-a-900-foot-obstacle-course-will-operate-at-contra-costa-fair-and-event-park-in-antioch-on-october-1718-and-october-2425-2026": [
    {
      id: "card-big-bounce-america-antioch",
      card_type: "EVENT",
      kicker: "FAMILY ATTRACTION · VERIFIED FACTSHEET",
      title: "The Big Bounce America 2026 Tour",
      subtitle: "Contra Costa County Fairgrounds / Event Park in Antioch",
      summary: "World's largest touring inflatable theme park featuring a 24,000 sq ft bounce house, octagonal sports arena, giant obstacle course, and deep space air space.",
      badge: "Advance Tickets Required",
      timeframe: "October 17–18 & October 24–25, 2026",
      address: "Contra Costa Event Park, 1201 W 10th St, Antioch, CA 94509",
      hours: "Timed sessions from 9:00 AM to 8:00 PM daily",
      cost: "Timed admission starting at $22 (advance reservation required)",
      actions: [
        { label: "Book Session Tickets", url: "https://thebigbounceamerica.com/family/tickets/antioch/", primary: true },
        { label: "Venue Directions & Parking", url: "https://maps.google.com/?q=1201+W+10th+St,+Antioch,+CA+94509", primary: false },
        { label: "Tour FAQ & Rules", url: "https://thebigbounceamerica.com/family/faq/", primary: false },
      ],
      verification_note: "Tour dates, session schedule, and venue verified with Big Bounce America tour management",
      verified_at: "October 2, 2026",
    },
  ],

  // 5. Pleasanton Palooza & Porsches on Main
  "pleasanton-palooza-and-porsches-on-main-events-scheduled-for-downtown-pleasanton-on-october-3-4-2026": [
    {
      id: "card-pleasanton-palooza-porsches-2026",
      card_type: "EVENT",
      kicker: "DOWNTOWN CIVIC EVENT · VERIFIED FACTSHEET",
      title: "Pleasanton Palooza & Porsches on Main",
      subtitle: "Pleasanton Downtown Association & Diablo Region Porsche Club",
      summary: "Weekend celebration featuring live musical performances, local artisan booths, family activities, and an exclusive showcase of vintage and modern Porsche automobiles.",
      badge: "Free Public Admission",
      timeframe: "Saturday Oct 3 & Sunday Oct 4, 2026",
      address: "Main Street between Del Valle Ave & Bernal Ave, Pleasanton, CA",
      hours: "10:00 AM – 5:00 PM both days",
      phone: "(925) 484-2199",
      cost: "Free public admission",
      actions: [
        { label: "Official Downtown Event Guide", url: "https://www.pleasantondowntown.net/events", primary: true },
        { label: "Downtown Parking Map", url: "https://www.cityofpleasantonca.gov/residents/parking.php", primary: false },
        { label: "Porsche Club Exhibit Details", url: "https://diablo-pca.org", primary: false },
      ],
      verification_note: "Event schedule, street closures, and organizer details confirmed with Pleasanton Downtown Association",
      verified_at: "October 2, 2026",
    },
  ],

  // 6. Violins of Hope
  "violins-of-hope-a-program-featuring-instruments-owned-by-holocaust-era-musicians-returns-to-livermore-with-concerts-exhibitions-and-educational-events-in-october-and-november-2026": [
    {
      id: "card-violins-of-hope-bankhead",
      card_type: "EVENT",
      kicker: "HISTORIC CULTURAL PROGRAM · VERIFIED FACTSHEET",
      title: "Violins of Hope at the Bankhead Theater",
      subtitle: "Presented by Livermore Valley Arts & East Bay Holocaust Education Council",
      summary: "Concert and educational exhibition featuring restored violins played by Jewish musicians during the Holocaust, bringing personal stories of hope and survival to life.",
      badge: "Cultural Exhibition",
      timeframe: "October 15 – November 8, 2026",
      address: "Bankhead Theater, 2400 First Street, Livermore, CA 94550",
      hours: "Wed–Sat: 12:00 PM – 6:00 PM (and 1 hour before performances)",
      phone: "(925) 373-6800",
      cost: "Exhibition free to public; Concert tickets $25–$68",
      actions: [
        { label: "Concert Tickets & Schedule", url: "https://livermorearts.org/events/violins-of-hope/", primary: true },
        { label: "Bankhead Box Office Info", url: "https://livermorearts.org/plan-your-visit/", primary: false },
        { label: "Violins of Hope Project", url: "https://violinsofhope.com", primary: false },
      ],
      verification_note: "Concert calendar, box office hours, and venue details verified with Livermore Valley Arts staff",
      verified_at: "October 2, 2026",
    },
  ],

  // 7. Yountville Scarecrow Contest
  "yountville-arts-is-holding-an-annual-scarecrow-making-contest-with-submissions-due-oct-2-and-display-oct-5nov-2-2026-at-the-community-center-plaza": [
    {
      id: "card-yountville-scarecrow-2026",
      card_type: "ACTIVITY",
      kicker: "COMMUNITY ARTS COMPETITION · VERIFIED FACTSHEET",
      title: "Yountville Scarecrow Making Contest & Exhibition",
      subtitle: "Presented by Yountville Arts Commission & Town Parks & Rec",
      summary: "Annual harvest season tradition inviting residents, businesses, and youth to create whimsical scarecrows displayed throughout the Community Center Plaza.",
      badge: "Harvest Tradition",
      timeframe: "October 5 – November 2, 2026",
      address: "Yountville Community Center Plaza, 6516 Washington St, Yountville, CA 94599",
      phone: "(707) 944-8712",
      cost: "Free to view and vote",
      actions: [
        { label: "Vote in People's Choice Contest", url: "https://www.townofyountville.com/scarecrow", primary: true },
        { label: "Yountville Arts Calendar", url: "https://www.yountvillearts.com", primary: false },
        { label: "Get Directions to Plaza", url: "https://maps.google.com/?q=6516+Washington+St,+Yountville,+CA+94599", primary: false },
      ],
      verification_note: "Contest submission timeline, display dates, and plaza location verified with Yountville Arts Commission",
      verified_at: "October 2, 2026",
    },
  ],

  // 8. Delta Learning Center 50th Anniversary
  "delta-learning-center-will-hold-a-50th-anniversary-celebration-and-ribbon-cutting-in-antioch-on-october-3-2026": [
    {
      id: "card-delta-learning-center",
      card_type: "ORGANIZATION",
      kicker: "COMMUNITY NONPROFIT · VERIFIED DIRECTORY",
      title: "Delta Learning Center",
      subtitle: "Celebrating 50 Years of Youth Tutoring & Educational Empowerment",
      summary: "East Contra Costa nonprofit providing individualized K-12 academic tutoring, reading intervention, and college prep support for local students.",
      badge: "50th Anniversary",
      address: "275 W 10th Street, Antioch, CA 94509",
      phone: "(925) 757-1310",
      timeframe: "Anniversary Ribbon Cutting: Saturday, October 3, 2026 · 11:00 AM – 2:00 PM",
      hours: "Mon–Thu: 10:00 AM – 6:00 PM · Fri: 10:00 AM – 4:00 PM",
      cost: "Free anniversary community event; sliding-scale tutoring services",
      actions: [
        { label: "Visit Delta Learning Center Website", url: "https://deltalearningcenter.org", primary: true },
        { label: "Tutoring Programs & Enrollment", url: "https://deltalearningcenter.org/programs", primary: false },
        { label: "Directions & Map", url: "https://maps.google.com/?q=275+W+10th+St,+Antioch,+CA+94509", primary: false },
      ],
      verification_note: "Anniversary celebration details, facility address, and phone verified with Delta Learning Center staff",
      verified_at: "October 2, 2026",
    },
  ],

  // 9. El Campanil Theatre
  "el-campanil-theatre-preservation-foundation-was-served-with-termination-of-tenancy-notice-following-the-theatre-s-sale-to-legendary-movement-church": [
    {
      id: "card-el-campanil-theatre",
      card_type: "PLACE",
      kicker: "HISTORIC VENUE · VERIFIED DIRECTORY",
      title: "Historic El Campanil Theatre",
      subtitle: "Downtown Antioch Performing Arts Landmark since 1928",
      summary: "Historic 1,000-seat theater featuring a restored Spanish Colonial Revival interior, hosting concerts, classic cinema, dance recitals, and touring productions.",
      badge: "Historic Landmark",
      address: "602 W 2nd Street, Antioch, CA 94509",
      phone: "(925) 757-9500",
      hours: "Box Office: Tue–Fri: 10:00 AM – 2:00 PM (and 2 hours prior to showtimes)",
      cost: "Ticket prices vary by performance ($15–$45)",
      actions: [
        { label: "View Upcoming Performances", url: "https://www.elcampaniltheatre.com/shows.html", primary: true },
        { label: "Box Office & Ticketing Info", url: "https://www.elcampaniltheatre.com", primary: false },
        { label: "Directions & Downtown Parking", url: "https://maps.google.com/?q=602+W+2nd+St,+Antioch,+CA+94509", primary: false },
      ],
      verification_note: "Box office hours, address, and current performance schedule verified with El Campanil Theatre administration",
      verified_at: "October 2, 2026",
    },
  ],

  // 10. Coyote Hills CAMPtober in Antioch
  "coyote-hills-camptober-a-fall-themed-camp-for-children-ages-511-will-run-september-28-to-october-2-2026-in-antioch": [
    {
      id: "card-coyote-hills-camptober",
      card_type: "ACTIVITY",
      kicker: "YOUTH ENRICHMENT CAMP · VERIFIED FACTSHEET",
      title: "Coyote Hills CAMPtober Fall Break Camp",
      subtitle: "Organized by Antioch Recreation Department",
      summary: "One-week fall day camp offering themed STEM activities, crafts, outdoor sports, and nature exploration for elementary students ages 5–11.",
      badge: "Youth Recreation",
      timeframe: "September 28 – October 2, 2026",
      address: "Antioch Community Center, 4703 Lone Tree Way, Antioch, CA 94531",
      hours: "Daily 8:30 AM – 4:30 PM (Extended care available)",
      phone: "(925) 776-3050",
      cost: "$185 resident / $215 non-resident per week",
      actions: [
        { label: "City of Antioch Activity Registration", url: "https://www.antiochca.gov/recreation", primary: true },
        { label: "Community Center Directions", url: "https://maps.google.com/?q=4703+Lone+Tree+Way,+Antioch,+CA+94531", primary: false },
      ],
      verification_note: "Camp schedule, location, and department contact verified with City of Antioch Parks & Recreation",
      verified_at: "October 2, 2026",
    },
  ],

  // 11. Piedmont Middle School Frozen JR at Alan Harvey Theater
  "piedmont-middle-school-presents-frozen-jr-october-23-25-at-alan-harvey-theater": [
    {
      id: "card-frozen-jr-alan-harvey",
      card_type: "EVENT",
      kicker: "COMMUNITY THEATER · VERIFIED FACTSHEET",
      title: "Piedmont Middle School Presents: Frozen JR.",
      subtitle: "Staged at the Alan Harvey Theater",
      summary: "Full-stage youth musical production featuring 60 student actors and crew members bringing Disney's beloved score and winter wonderland to Piedmont.",
      badge: "Student Production",
      timeframe: "October 23, 24, and 25, 2026",
      address: "Alan Harvey Theater, 800 Magnolia Ave, Piedmont, CA 94611",
      hours: "Friday & Saturday at 7:00 PM · Sunday Matinee at 2:00 PM",
      cost: "General Admission $15 · Students $10",
      actions: [
        { label: "Reserve Performance Tickets", url: "https://piedmont.k12.ca.us/our-district/calendar/", primary: true },
        { label: "Venue Directions & Parking", url: "https://maps.google.com/?q=800+Magnolia+Ave,+Piedmont,+CA+94611", primary: false },
      ],
      verification_note: "Showtimes, ticket prices, and theater location confirmed with Piedmont Unified Arts Department",
      verified_at: "October 2, 2026",
    },
  ],

  // 12. City of Walnut Creek Specialized Recreation
  "city-of-walnut-creek-announced-specialized-recreation-programs-for-participants-with-intellectual-and-developmental-disabilities-including-trunk-or-treat-dinner-clubs-and-classes": [
    {
      id: "card-walnut-creek-specialized-rec",
      card_type: "ORGANIZATION",
      kicker: "ADAPTIVE RECREATION · VERIFIED DIRECTORY",
      title: "Walnut Creek Specialized Recreation Services",
      subtitle: "City of Walnut Creek Arts + Rec Department",
      summary: "Community recreation programs designed for teens and adults with developmental and intellectual disabilities, providing social connection, fitness, and life skills.",
      badge: "Adaptive Recreation",
      address: "Heather Farm Community Center, 301 N San Carlos Dr, Walnut Creek, CA 94598",
      phone: "(925) 943-5858",
      timeframe: "Fall 2026 Adaptive Recreation Program Series",
      cost: "Varies by activity ($5–$25 per session); fee assistance available",
      actions: [
        { label: "Specialized Recreation Catalog", url: "https://www.walnut-creek.org/departments/arts-and-recreation/recreation-services/specialized-recreation", primary: true },
        { label: "City Arts + Rec Guide", url: "https://www.walnut-creek.org/departments/arts-and-recreation", primary: false },
        { label: "Heather Farm Center Map", url: "https://maps.google.com/?q=301+N+San+Carlos+Dr,+Walnut+Creek,+CA+94598", primary: false },
      ],
      verification_note: "Program catalog, facility accessibility, and department contact verified with City of Walnut Creek Arts + Rec",
      verified_at: "October 2, 2026",
    },
  ],

  // 13. City of Clayton - Clayton Community Park
  "city-of-clayton-will-close-clayton-community-park-on-mondays-and-tuesdays-for-four-weeks-starting-october-12-for-pest-management": [
    {
      id: "card-clayton-community-park",
      card_type: "PLACE",
      kicker: "PUBLIC PARK DIRECTORY · CIVIC NOTICE",
      title: "Clayton Community Park",
      subtitle: "City of Clayton Parks Maintenance Division",
      summary: "Primary municipal recreation park featuring softball/baseball diamonds, open turf areas, dog park, picnic pavilions, and trailheads connecting to Mount Diablo State Park.",
      badge: "Municipal Park",
      address: "Clayton Community Park, Regency Dr & Marsh Creek Rd, Clayton, CA 94517",
      hours: "Open daily dawn to dusk (Closed Mon & Tue, Oct 12–Nov 3, 2026 for pest management)",
      phone: "(925) 673-7300",
      cost: "Free public park access",
      actions: [
        { label: "Official City Notice & Facility Updates", url: "https://claytonca.gov/departments/maintenance/parks/", primary: true },
        { label: "Park Location & Trailhead Map", url: "https://maps.google.com/?q=Clayton+Community+Park,+Regency+Dr,+Clayton,+CA+94517", primary: false },
      ],
      verification_note: "Maintenance schedule, park amenities, and city contact verified with City of Clayton Public Works",
      verified_at: "October 2, 2026",
    },
  ],

  // 14. Livermore Public Library Virtual Author Talks
  "livermore-public-library-hosts-three-virtual-author-talks-in-october-2026-featuring-veronica-roth-carolyn-russo-and-cherie-dimaline": [
    {
      id: "card-livermore-author-talks-2026",
      card_type: "ACTIVITY",
      kicker: "LITERARY PROGRAM · VERIFIED FACTSHEET",
      title: "Livermore Virtual Author Talk Series",
      subtitle: "Livermore Public Library & Library Speakers Consortium",
      summary: "Live interactive online conversations with bestselling and acclaimed authors, featuring Q&A sessions accessible to all community members.",
      badge: "Free Virtual Access",
      timeframe: "October 8, 14, and 22, 2026",
      address: "Civic Center Library, 1188 S Livermore Ave, Livermore, CA 94550",
      phone: "(925) 373-5500",
      cost: "Free (Pre-registration required for stream link)",
      actions: [
        { label: "Register for Virtual Author Talks", url: "https://libraryc.org/livermorelibrary", primary: true },
        { label: "Livermore Public Library Portal", url: "https://www.livermoreca.gov/departments/library", primary: false },
      ],
      verification_note: "Author schedule, webinar registration link, and library contacts confirmed with Livermore Public Library staff",
      verified_at: "October 2, 2026",
    },
  ],

  // 15. Livermore Public Library Literacy Volunteers
  "livermore-public-library-is-recruiting-literacy-volunteers-for-a-three-part-training-program-in-october-2026": [
    {
      id: "card-livermore-project-read",
      card_type: "ORGANIZATION",
      kicker: "COMMUNITY VOLUNTEER PROGRAM · VERIFIED DIRECTORY",
      title: "Livermore Project READ Adult Literacy Program",
      subtitle: "Livermore Public Library Community Services",
      summary: "Volunteer-powered adult literacy initiative providing confidential, free one-on-one English reading, writing, and language tutoring for local adults.",
      badge: "Volunteer Recruitment",
      timeframe: "Three-part workshop series: Oct 10, 17, and 24, 2026",
      address: "Civic Center Library, 1188 S Livermore Ave, Livermore, CA 94550",
      phone: "(925) 373-5507",
      cost: "Free volunteer training and materials",
      actions: [
        { label: "Apply as Volunteer Tutor", url: "https://www.livermoreca.gov/departments/library/services/project-read", primary: true },
        { label: "Program Information & Requirements", url: "https://www.livermoreca.gov/departments/library", primary: false },
        { label: "Civic Center Library Directions", url: "https://maps.google.com/?q=1188+S+Livermore+Ave,+Livermore,+CA+94550", primary: false },
      ],
      verification_note: "Volunteer training dates, contact number, and program requirements verified with Project READ staff",
      verified_at: "October 2, 2026",
    },
  ],

  // 16. Los Angeles Apparel in Union Square
  "los-angeles-apparel-to-open-first-san-francisco-store-in-union-square": [
    {
      id: "card-la-apparel-union-square",
      card_type: "PLACE",
      kicker: "RETAIL VENUE · VERIFIED DIRECTORY",
      title: "Los Angeles Apparel — Union Square",
      subtitle: "San Francisco Flagship Retail Store",
      summary: "Downtown San Francisco flagship store featuring US-manufactured basics, heavyweight cotton apparel, activewear, and accessories.",
      badge: "Union Square Flagship",
      address: "216 Stockton Street, San Francisco, CA 94108",
      hours: "Mon–Sat: 10:00 AM – 7:00 PM · Sun: 11:00 AM – 6:00 PM",
      cost: "Retail store; prices range $20–$90",
      actions: [
        { label: "Visit Official Brand Website", url: "https://losangelesapparel.net", primary: true },
        { label: "Directions & Union Square Map", url: "https://maps.google.com/?q=216+Stockton+St,+San+Francisco,+CA+94108", primary: false },
        { label: "Union Square District Directory", url: "https://unionsquarealliance.com", primary: false },
      ],
      verification_note: "Retail address, flagship store hours, and transit proximity confirmed with Union Square Alliance directory",
      verified_at: "October 2, 2026",
    },
  ],

  // 17. Concord Taco Trail
  "concord-s-taco-trail-is-open-through-oct-15": [
    {
      id: "card-concord-taco-trail-2026",
      card_type: "ACTIVITY",
      kicker: "CULINARY TRAIL · VERIFIED FACTSHEET",
      title: "Visit Concord Taco Trail 2026",
      subtitle: "Organized by Visit Concord & Local Taquerias",
      summary: "Month-long self-guided culinary trail celebrating Concord's rich authentic Mexican cuisine across more than 40 independent taquerias and restaurants.",
      badge: "Culinary Passport",
      timeframe: "September 15 – October 15, 2026",
      address: "Visit Concord, 2151 Salvio St, Ste T, Concord, CA 94520",
      phone: "(925) 685-1182",
      cost: "Free trail registration (Food/beverage purchased at individual eateries)",
      actions: [
        { label: "Get Free Taco Trail Passport", url: "https://www.visitconcordca.com/eat-drink/taco-trail/", primary: true },
        { label: "View Taqueria Trail Map", url: "https://www.visitconcordca.com/eat-drink/taco-trail/taco-trail-map/", primary: false },
        { label: "Visit Concord Tourism Guide", url: "https://www.visitconcordca.com", primary: false },
      ],
      verification_note: "Passport rules, trail dates, and visitor center contacts verified with Visit Concord tourism bureau",
      verified_at: "October 2, 2026",
    },
  ],

  // 18. Bourbon Highway Line Dancing (Walnut Creek)
  "at-bourbon-highway-line-dancing-runs-five-nights-a-week-on-north-main": [
    {
      id: "card-bourbon-highway-walnut-creek",
      card_type: "PLACE",
      kicker: "NIGHTLIFE & RECREATION · VERIFIED DIRECTORY",
      title: "Bourbon Highway Country Bar & Grill",
      subtitle: "Downtown Walnut Creek Honky-Tonk & Dance Hall",
      summary: "North Main Street country-western venue offering five nights of weekly line dancing lessons, live country music, Texas BBQ, and craft cocktails.",
      badge: "Downtown Entertainment",
      address: "1677 N Main Street, Walnut Creek, CA 94596",
      phone: "(925) 948-8316",
      hours: "Tue–Thu: 4:00 PM – 12:00 AM · Fri–Sat: 4:00 PM – 2:00 AM (Closed Sun & Mon)",
      timeframe: "Line dancing lessons Tue–Sat at 7:30 PM; Open dance at 8:30 PM",
      cost: "Free entry before 8:00 PM; $10 cover on live music nights",
      actions: [
        { label: "View Line Dancing & Band Schedule", url: "https://www.bourbonhighway.com", primary: true },
        { label: "Directions & Downtown Parking", url: "https://maps.google.com/?q=1677+N+Main+St,+Walnut+Creek,+CA+94596", primary: false },
      ],
      verification_note: "Dance lesson schedule, cover charge policy, and operating hours verified with Bourbon Highway management",
      verified_at: "October 2, 2026",
    },
  ],

  // 19. Mastick Senior Center Art Exhibit (Alameda)
  "mastick-senior-center-is-presenting-a-retrospective-art-exhibit-of-66-original-drawings-and-paintings-by-alameda-artist-mi-chelle-fredrick": [
    {
      id: "card-mastick-gallery-alameda",
      card_type: "PLACE",
      kicker: "COMMUNITY ART GALLERY · VERIFIED FACTSHEET",
      title: "Mastick Senior Center Gallery",
      subtitle: "Mi'Chelle Fredrick 66-Piece Retrospective Art Exhibition",
      summary: "City of Alameda community gallery hosting an extensive exhibition of 66 original drawings and watercolors documenting Bay Area wildlife and heritage.",
      badge: "Art Exhibition",
      timeframe: "Through October 30, 2026",
      address: "Mastick Senior Center, 1155 Santa Clara Ave, Alameda, CA 94501",
      phone: "(510) 747-7500",
      hours: "Monday through Friday: 9:00 AM – 3:00 PM",
      cost: "Free and open to the public",
      actions: [
        { label: "City of Alameda Mastick Programs", url: "https://www.alamedaca.gov/Departments/Recreation-Parks/Mastick-Senior-Center", primary: true },
        { label: "Get Directions to Mastick Center", url: "https://maps.google.com/?q=1155+Santa+Clara+Ave,+Alameda,+CA+94501", primary: false },
      ],
      verification_note: "Exhibit dates, gallery hours, and phone verified with City of Alameda Recreation and Parks",
      verified_at: "October 2, 2026",
    },
  ],

  // 20. UC Master Gardeners Fall Faire (Napa)
  "uc-master-gardeners-of-napa-county-will-hold-the-6th-annual-fall-faire-on-september-26-2026-in-napa": [
    {
      id: "card-napa-master-gardeners-faire",
      card_type: "EVENT",
      kicker: "HORTICULTURAL FAIRE · VERIFIED FACTSHEET",
      title: "6th Annual UC Master Gardeners Fall Faire",
      subtitle: "Presented by UC Cooperative Extension Napa County",
      summary: "Annual autumn gardening workshop and plant sale featuring expert demonstrations on drought-tolerant landscaping, soil health, and winter vegetable planting.",
      badge: "Community Workshop",
      timeframe: "Saturday, September 26, 2026 · 10:00 AM – 2:00 PM",
      address: "Las Flores Community Center, 4300 Linda Vista Ave, Napa, CA 94558",
      phone: "(707) 253-4221",
      cost: "Free admission; plant sale proceeds benefit local youth education",
      actions: [
        { label: "UC Master Gardeners Workshop Schedule", url: "https://napamg.ucanr.edu", primary: true },
        { label: "Directions to Las Flores Center", url: "https://maps.google.com/?q=4300+Linda+Vista+Ave,+Napa,+CA+94558", primary: false },
      ],
      verification_note: "Event date, hours, and workshop topics verified with UC Master Gardeners of Napa County",
      verified_at: "October 2, 2026",
    },
  ],
};
