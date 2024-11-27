const csvUrls = {
    "event_core_list": "https://raw.githubusercontent.com/tdwg/dwc/refs/heads/master/build/xml/event_core_list.csv",
    "occurrence_core_list": "https://raw.githubusercontent.com/tdwg/dwc/refs/heads/master/build/xml/occurrence_core_list.csv",
    "taxon_core_list": "https://raw.githubusercontent.com/tdwg/dwc/refs/heads/master/build/xml/taxon_core_list.csv"
};

const xmlUrls = {
    "dna_derived_data": "https://rs.gbif.org/extension/gbif/1.0/dna_derived_data_2024-07-11.xml",
    "audiovisual": "https://rs.gbif.org/extension/ac/audiovisual_2024_11_07.xml",
    "humboldt": "https://rs.gbif.org/extension/eco/Humboldt_2024-04-16.xml",
    "dwc_occurrence": "https://rs.gbif.org/core/dwc_occurrence_2024-02-23.xml",
    "identification_history": "https://rs.gbif.org/extension/identification_history_2024-02-19.xml",
    "extended_measurement_or_fact": "https://rs.gbif.org/extension/obis/extended_measurement_or_fact_2023-08-28.xml",
    "resource_relationship": "https://rs.gbif.org/extension/resource_relationship_2024-02-19.xml"
};

// Define colors for each source file
const groupColors = {
    "Record-level": "#FFDDC1", // Light orange
    "Occurrence": "#FFD1DC", // Light pink
    "Organism": "#D1E8FF", // Light blue
    "Event": "#C8E6C9", // Light green
    "Location": "#FFEBEE", // Light red
    "GeologicalContext": "#FFF9C4", // Light yellow
    "Identification": "#E1BEE7", // Light purple
    "Taxon": "#B3E5FC", // Light sky blue
    "Undefined": "#F0F4C3", // Light lime
    "MaterialEntity": "#FFCCBC", // Light peach
};

const usedTerms = new Set(); // To keep track of used terms
const definitions = {}; // To store definitions based on term_localName
const termPoolTerms = new Set(); // To keep track of all terms loaded into the term pool

async function fetchDefinitions() {
    const response = await fetch("https://raw.githubusercontent.com/tdwg/dwc/refs/heads/master/vocabulary/term_versions.csv");
    const text = await response.text();
    Papa.parse(text, {
        header: true,
        complete: function (results) {
            results.data.forEach(row => {
                if (row.term_localName && row.definition) {
                    definitions[row.term_localName] = row.definition; // Store the definition with term_localName as the key
                }
            });
            console.log("Definitions loaded:", definitions); // Log loaded definitions for debugging
        }
    });
}

// Call the function to fetch definitions at the start
fetchDefinitions();

document.getElementById('loadCsvButton').addEventListener('click', () => {
    const selectedCsvs = Array.from(document.querySelectorAll('.checkbox-container input[type="checkbox"]:checked'))
        .map(input => input.value);
    
    if (selectedCsvs.length) {
        loadSelectedTerms(selectedCsvs);
    } else {
        console.error("No CSVs selected!");
    }
});

document.getElementById('addGbifTermsButton').addEventListener('click', () => {
    const gbifObisTerms = [
        'eventID',
        'eventDate',
        'decimalLatitude',
        'decimalLongitude',
        'samplingProtocol',
        'samplingSizeValue',
        'samplingSizeUnit',
        'occurrenceID',
        'scientificName',
        'basisOfRecord',
        'kingdom',
        'scientificNameID',
        'occurrenceStatus'
    ];

    const coreTable = document.querySelectorAll('.group')[0]; // Assuming the first group is the Core Table

    // Collect existing terms from the term pool
    const termPoolElements = document.querySelectorAll('.source-pool .shallow-draggable');
    const existingTermsInPool = new Map(Array.from(termPoolElements).map(el => [el.textContent.trim(), el.style.backgroundColor]));

    // Add only those GBIF/OBIS terms that exist in the term pool
    gbifObisTerms.forEach(term => {
        if (existingTermsInPool.has(term)) {
            const termParagraph = document.createElement('p');
            termParagraph.className = 'shallow-draggable';
            termParagraph.textContent = term; // The term to add
            termParagraph.setAttribute('draggable', 'true');
            termParagraph.setAttribute('title', `Description for ${term}`); // Placeholder for definition
            
            // Retrieve the color of the matched term from the term pool
            const matchedColor = existingTermsInPool.get(term);
            termParagraph.style.backgroundColor = matchedColor; // Set the same color as in the term pool

            coreTable.appendChild(termParagraph); // Add the term to the Core Table
        }
    });

    // Sort the terms in the Core Table by their background color after adding
    sortByColor(coreTable);

    setupDraggables(); // Call the function to make new terms draggable
});

function loadSelectedTerms(selectedTerms) {
    const sourcePool = document.querySelector(".source-pool");
    sourcePool.innerHTML = ''; // Clear the Term Pool initially

    const groupedTerms = {};

    // Load selected terms from CSV or XML
    selectedTerms.forEach(term => {
        if (csvUrls[term]) {
            Papa.parse(csvUrls[term], {
                download: true,
                header: true,
                complete: function (results) {
                    if (results && results.data.length > 0) {
                        console.log(`Loaded ${term} data:`, results.data); // Log fetched data

                        results.data.forEach(item => {
                            const group = item.group || 'Undefined';
                            const tagName = item.iri ? item.iri.substring(item.iri.lastIndexOf('/') + 1) : item.term;
                            const localName = tagName; // Keep the local name

                            const definition = definitions[localName] ? definitions[localName] : "No definition available";
                            console.log(`Local Name: ${localName}, Definition: ${definition}`); // Log for each local name

                            // Apply color based on the source
                            const color = groupColors[term] || "#FFFFFF"; // Default to white if color not defined

                            if (!groupedTerms[group]) {
                                groupedTerms[group] = new Set(); // Initialize a set for grouping
                            }
                            groupedTerms[group].add({ term: localName, definition, color }); // Add term to grouped terms with color
                            termPoolTerms.add(localName); // Keep track of all terms in the term pool
                        });

                        populateSourcePool(groupedTerms);
                    } else {
                        console.error(`No data found for ${term}`);
                    }
                },
                error: function (error) {
                    console.error("Error fetching or parsing CSV:", error);
                }
            });
        } else if (xmlUrls[term]) {
            console.log(`Loading XML for ${term} from ${xmlUrls[term]}`); // Log when starting to load XML
            fetch(xmlUrls[term])
                .then(response => response.text())
                .then(str => (new window.DOMParser()).parseFromString(str, "text/xml"))
                .then(data => {
                    const properties = data.getElementsByTagName('property');
                    console.log(`Found ${properties.length} properties in XML for ${term}.`);
                    Array.from(properties).forEach(property => {
                        const name = property.getAttribute('name');
                        const group = property.getAttribute('group') || 'Undefined';
                        if (name && name !== 'Unnamed') {
                            console.log(`Parsed Property - Name: ${name}, Group: ${group}`); // Log each property parsed
                            const color = groupColors[term] || "#FFFFFF"; // Default to white if no color defined
                            if (!groupedTerms[group]) {
                                groupedTerms[group] = new Set(); // Initialize the set if it does not exist
                            }
                            const definition = definitions[name] || "No definition available"; // Check against definitions
                            groupedTerms[group].add({ term: name, definition, color }); // Add term with color
                            termPoolTerms.add(name); // Keep track of all terms in the term pool
                            console.log(`XML Local Name: ${name}, Definition: ${definition}`); // Log XML local name with its definition
                        }
                    });

                    populateSourcePool(groupedTerms);
                })
                .catch(error => console.error("Error fetching or parsing XML:", error));
        }
    });
}

function populateSourcePool(groupedTerms) {
    const sourcePool = document.querySelector(".source-pool");
    sourcePool.innerHTML = ''; // Clear the Term Pool initially

    // Collect existing terms from the group containers to check for matches
    const existingTerms = new Set();
    const groups = document.querySelectorAll('.group-container');

    groups.forEach(group => {
        Array.from(group.children).forEach(child => {
            existingTerms.add(child.textContent.trim()); // Store existing terms in a set for fast lookup
        });
    });

    // Create a section for each group in the source pool
    Object.keys(groupedTerms).forEach(group => {
        const groupContainer = document.createElement('div');
        groupContainer.className = 'group-container';
        
        // Create and append the group title
        const groupTitle = document.createElement('h3');
        groupTitle.textContent = group;  // Add the group name as a title
        groupContainer.appendChild(groupTitle);
        
        const termsArray = Array.from(groupedTerms[group]).filter(item => item.term); // Only add defined terms
        termsArray.sort((a, b) => (a.term && b.term) ? a.term.localeCompare(b.term) : 0); // Sort terms alphabetically

        // Append sorted terms to the group container using the appropriate group color
        termsArray.forEach(item => {
            const termElement = document.createElement('p');
            termElement.className = 'shallow-draggable'; // Same class name
            termElement.textContent = item.term; // Use the term stored in the object
            termElement.setAttribute('draggable', 'true');

            // Set the title attribute for tooltip
            const definition = definitions[item.term] || "No definition available"; // Find definition based on term
            termElement.setAttribute('title', definition); // Set the title for the tooltip

            // Use the group color from the groupColors mapping
            const groupColor = groupColors[group] || groupColors["Undefined"]; // Default to Undefined color
            termElement.style.backgroundColor = groupColor; // Set background color based on group

            // Check if the term exists in the existing term set
            if (existingTerms.has(item.term)) {
                termElement.style.opacity = '0.5'; // Set to 50% transparency
            }

            groupContainer.appendChild(termElement); // Append to the group container
        });

        if (termsArray.length > 0) {
            sourcePool.appendChild(groupContainer); // Append the group container to the source pool only if it contains terms
        }
    });

    setupDraggables(); // Setup draggables after appending
}

function setupDraggables() {
    const draggables = document.querySelectorAll(".shallow-draggable");
    const groups = document.querySelectorAll(".group");
    const sourcePool = document.querySelector(".source-pool");

    draggables.forEach((draggable) => {
        draggable.addEventListener("dragstart", () => {
            draggable.classList.add("dragging");
        });
        draggable.addEventListener("dragend", () => {
            draggable.classList.remove("dragging");
        });
    });

    groups.forEach((group) => {
        group.addEventListener("dragover", (e) => e.preventDefault());
        group.addEventListener("drop", (e) => {
            e.preventDefault();
            const dragging = document.querySelector(".dragging");
            if (dragging) {
                // Check if the term is already in the group
                const isDuplicate = Array.from(group.children).some(child => child.textContent === dragging.textContent);
                if (!isDuplicate) { // Only append the term if it's not a duplicate
                    group.appendChild(dragging);
                    usedTerms.add(dragging.textContent); // Mark term as used
                }

                // Sort the children of the group container by their background color
                sortByColor(group);
            }
        });
    });

    sourcePool.addEventListener("dragover", (e) => e.preventDefault());
    sourcePool.addEventListener("drop", (e) => {
        e.preventDefault();
        const dragging = document.querySelector(".dragging");
        if (dragging) {
            // Move term back to source pool
            sourcePool.appendChild(dragging);
            usedTerms.delete(dragging.textContent); // Remove from used set
        }
    });
}

function sortByColor(group) {
    const childrenArray = Array.from(group.children);
    const sortedChildren = childrenArray.sort((a, b) => {
        const colorA = a.style.backgroundColor;
        const colorB = b.style.backgroundColor;

        // Simple color comparison logic
        return colorA.localeCompare(colorB);
    });

    // Clear the group container
    group.innerHTML = '';

    // Append sorted children back into the group container
    sortedChildren.forEach(child => {
        group.appendChild(child);
    });
}

// Initialize the application
fetchDefinitions();