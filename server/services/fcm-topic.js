'use strict';

const { propOr } = require('lodash/fp');



const { getFetchParams } = require('@strapi/strapi/lib/core-api/service');

const {
    hasDraftAndPublish,
    constants: { PUBLISHED_AT_ATTRIBUTE },
} = require('@strapi/utils').contentTypes;

const setPublishedAt = data => {
    data[PUBLISHED_AT_ATTRIBUTE] = propOr(new Date(), PUBLISHED_AT_ATTRIBUTE, data);
};

/**
 *  service.
 */

const uid = 'plugin::strapi-plugin-fcm.fcm-topic';
module.exports = ({ strapi }) => ({
    async find(params = {}) {
        const fetchParams = getFetchParams(params);
        
        // Extract pagination parameters
        const page = parseInt(params.pagination?.page) || 1;
        const pageSize = parseInt(params.pagination?.pageSize) || 25;
        const start = (page - 1) * pageSize;
        const limit = pageSize;

        const data = await strapi.entityService.findMany(uid, {
            ...fetchParams,
            start,
            limit,
        });

        // Get total count for pagination
        const count = await strapi.entityService.count(uid, { ...fetchParams });
        const pageCount = Math.ceil(count / pageSize);

        return {
            data,
            pagination: {
                page,
                pageSize,
                pageCount,
                total: count,
            },
        };
    },

    async findOne(entityId, params) {
        return strapi.entityService.findOne(uid, entityId, getFetchParams(params));
    },

    async create(params = {}) {
        const { data } = params;
        const contentType = strapi.contentTypes[uid];

        if (hasDraftAndPublish(contentType)) {
            setPublishedAt(data);
        }

        return strapi.entityService.create(uid, { ...params, data });
    },

    async update(entityId, params = {}) {
        const { data } = params;

        return strapi.entityService.update(uid, entityId, { ...params, data });
    },

    async delete(entityId, params = {}) {
        return strapi.entityService.delete(uid, entityId, params);
    },

    count(params = {}) {
        return strapi.query(uid).count({ where: params });
    },
});
