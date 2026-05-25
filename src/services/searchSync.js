// services/searchService.js
const esClient = require('../config/elastic');

// 1. Send show metadata to Elasticsearch for fast location filtering
async function syncShowToElastic(showId, dbConnection) {
    // Fetch joined record from SQL
    const [rows] = await dbConnection.execute(`
        SELECT s.show_id, s.start_time, s.base_price, m.title, m.language, t.name as theater_name, t.city_id, t.latitude, t.longitude
        FROM shows s
        JOIN movies m ON s.movie_id = m.movie_id
        JOIN screens sc ON s.screen_id = sc.screen_id
        JOIN theaters t ON sc.theater_id = t.theater_id
        WHERE s.show_id = ?
    `, [showId]);

    if (rows.length === 0) return;
    const data = rows[0];

    // Format into a clean, flat document
    const document = {
        show_id: data.show_id,
        start_time: data.start_time,
        base_price: data.base_price,
        movie_title: data.title,
        movie_language: data.language,
        theater_name: data.theater_name,
        city_id: data.city_id,
        location: {
            lat: parseFloat(data.latitude),
            lon: parseFloat(data.longitude)
        }
    };

    // Index it into Elasticsearch
    await esClient.index({
        index: 'shows_catalog',
        id: showId.toString(),
        document: document
    });
}

// 2. Query movies by city and sort by user's near coordinates
async function searchMoviesByCity(cityId, userLat, userLon) {
    const response = await esClient.search({
        index: 'shows_catalog',
        query: {
            bool: {
                must: [
                    { term: { city_id: cityId } } // Filters only their city
                ]
            }
        },
        sort: [
            {
                _geo_distance: {
                    location: { lat: userLat, lon: userLon },
                    order: "asc",
                    unit: "km"
                }
            }
        ]
    });

    return response.hits.hits.map(hit => hit._source);
}

module.exports = { syncShowToElastic, searchMoviesByCity };