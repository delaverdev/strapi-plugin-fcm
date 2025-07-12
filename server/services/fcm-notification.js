'use strict';

/**
 *  service.
 */

var fcmUtil = require('../../util/fcm');

const { propOr } = require('lodash/fp');



const { getFetchParams } = require('@strapi/strapi/lib/core-api/service');

const {
    hasDraftAndPublish,
    constants: { PUBLISHED_AT_ATTRIBUTE },
} = require('@strapi/utils').contentTypes;

const setPublishedAt = data => {
    data[PUBLISHED_AT_ATTRIBUTE] = propOr(new Date(), PUBLISHED_AT_ATTRIBUTE, data);
};

const uid = 'plugin::strapi-plugin-fcm.fcm-notification';
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

    async delete(entityId, params = {}) {
        return strapi.entityService.delete(uid, entityId, params);
    },

    async send(body) {
        return await fcmUtil.send(body.data);
    },

    async create(params = {}) {
        const model = strapi.contentTypes[uid];
        const setupEntry = async (entry) => {
            if (hasDraftAndPublish(model)) {
                setPublishedAt(entry);
            }
            if (entry[PUBLISHED_AT_ATTRIBUTE]) {
                const fcmResponse = await fcmUtil.send(entry);
                entry.response = fcmResponse || {};
            }
            entry.payload = entry.payload || {};
            return entry;
        };
        const { data } = params;
        if (Array.isArray(data)) {
            if (data.length > 0) {
                const entries = await Promise.all(data.map(d => setupEntry(d)));
                return strapi.db.query(uid).createMany({ data: entries });
            } else {
                throw Error('Data array is empty!');
            }
        } else {
            const entry = await setupEntry(data);
            return strapi.entityService.create(uid, { data: entry });
        }
    },

    async update(entityId, params = {}) {
        const { data } = params;
        if (Object.keys(data.response || {}).length === 0) {
            const fcmResponse = await fcmUtil.send(data);
            data.response = fcmResponse || {};
        }
        data.payload = data.payload || {};
        return strapi.entityService.update(uid, entityId, { ...params, data });
    },

    count(params = {}) {
        return strapi.query(uid).count({ where: params });
    },
});
