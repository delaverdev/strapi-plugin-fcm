'use strict';

const { getFetchParams } = require('@strapi/strapi/lib/core-api/service');


// we will use this for now, until we have a better way.
const getQuery = (
    devicesTokensCollectionName,
    deviceTokenFieldName,
    deviceLabelFieldName,
    offset = 0,
    limit = 25
) => {
    if (!devicesTokensCollectionName) {
        return `select fcm_topics.name as label, 'topic' as type, fcm_topics.name as value from fcm_topics limit ${limit} offset ${offset}`;
    }
    return `(select fcm_topics.label as label, 'topic' as type, fcm_topics.name as value from fcm_topics)
union all
(select ${devicesTokensCollectionName}.${deviceLabelFieldName} as label, 'token' as type, ${devicesTokensCollectionName}.${deviceTokenFieldName} as value from ${devicesTokensCollectionName} where coalesce(TRIM(${devicesTokensCollectionName}.${deviceTokenFieldName}), '') <> '') limit ${limit} offset ${offset}`;

};

const countQuery = (
    devicesTokensCollectionName,
    deviceTokenFieldName
) => {
    if (!devicesTokensCollectionName) {
        return `select count(*) as count from fcm_topics`;
    }
    return `select count(*) from ((select fcm_topics.name as value from fcm_topics)
union all
(select ${devicesTokensCollectionName}.${deviceTokenFieldName} as value from ${devicesTokensCollectionName} where coalesce(TRIM(${devicesTokensCollectionName}.${deviceTokenFieldName}), '') <> '')) as targets;
`;
};

module.exports = ({ strapi }) => {
    const getConfigurationService = () => {
        return strapi.plugin('strapi-plugin-fcm').service('fcm-plugin-configuration');
    }

    return ({

    async find(params = {}) {
        const knex = strapi.db.connection;

        // Extract pagination parameters
        const page = parseInt(params.pagination?.page) || 1;
        const pageSize = parseInt(params.pagination?.pageSize) || 25;
        const start = (page - 1) * pageSize;
        const limit = pageSize;

        const configs = (await getConfigurationService().find()).data;
        // console.log('fcm-target configs', configs);

        const devicesTokensCollectionName = configs.devicesTokensCollectionName;
        const deviceTokenFieldName = configs.deviceTokenFieldName;
        const deviceLabelFieldName = configs.deviceLabelFieldName;

        const results = await knex.raw(
            getQuery(devicesTokensCollectionName,
                deviceTokenFieldName,
                deviceLabelFieldName,
                start,
                limit)
        );
        let rows
        switch (knex.client.config.client) {
          case 'better-sqlite3': {
            rows = results
            break;
          }
          default: {
            rows = results.rows || results[0];
            break;
          }
        }
        // console.log('fcm-target results', rows);

        // Get total count for pagination
        const countResult = await knex.raw(countQuery(devicesTokensCollectionName, deviceTokenFieldName));
        const count = (countResult.rows || countResult[0])?.[0]?.count || 0;
        const pageCount = Math.ceil(count / pageSize);

        return {
            data: rows,
            pagination: {
                page,
                pageSize,
                pageCount,
                total: count,
            },
        };
    },
    async count(params = {}) {
        const knex = strapi.db.connection;
        const configs = (await getConfigurationService().find()).data;
        const devicesTokensCollectionName = configs.devicesTokensCollectionName;
        const deviceTokenFieldName = configs.deviceTokenFieldName;
        return knex.raw(countQuery(devicesTokensCollectionName, deviceTokenFieldName));
    },

    });
};
