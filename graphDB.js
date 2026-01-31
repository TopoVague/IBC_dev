async function draw() {
    if (typeof vis === 'undefined') {
        console.error('vis is not defined');
        return;
    }

    const uri = "bolt://localhost:7687";
    const user = "neo4j";
    const password = "mmclibrary";

    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
    const session = driver.session();

    try {
        const result = await session.run(`
            MATCH (n)
            OPTIONAL MATCH (n)-[r]->(m)
            RETURN n, r, m
        `);
        console.log('Connection successful!', result.records);

        const nodes = new Map();
        const edges = [];

        result.records.forEach(record => {
            const n = record.get('n');
            const m = record.get('m');
            const r = record.get('r');

            if (n && !nodes.has(n.identity.low)) {
                nodes.set(n.identity.low, {
                    id: n.identity.low,
                    label: n.properties.name || n.properties.id || `Node ${n.identity.low}`,
                    shape: 'dot', 
                    font: {
                        size: 14, 
                        color: '#000000' 
                    }
                });
            }
            if (m && !nodes.has(m.identity.low)) {
                nodes.set(m.identity.low, {
                    id: m.identity.low,
                    label: m.properties.name || m.properties.id || `Node ${m.identity.low}`,
                    shape: 'dot', 
                    font: {
                        size: 14, 
                        color: '#000000' 
                    }
                });
            }
            if (r) {
                edges.push({
                    from: r.start.low,
                    to: r.end.low,
                    label: r.type,
                    font: {
                        align: 'top'
                    }
                });
            }
        });

        console.log('Nodes:', Array.from(nodes.values()));
        console.log('Relationships:', edges);

        const container = document.getElementById('viz');
        const data = {
            nodes: new vis.DataSet(Array.from(nodes.values())),
            edges: new vis.DataSet(edges)
        };
        const options = {
            layout: {
                improvedLayout: false
            }
        };
        const network = new vis.Network(container, data, options);

    } catch (error) {
        console.error('Connection failed:', error);
    } finally {
        await session.close();
        await driver.close();
    }
}

window.onload = draw;
