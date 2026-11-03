import type { CreateListAPI, GetListAPI, GetListsAPI, UpdateListAPI } from './types'

export const processListsResponse: GetListsAPI['processor'] = (response) => response.value

export const processListResponse: GetListAPI['processor'] & CreateListAPI['processor'] = (response) => response.value

export const processUpdateListResponse: UpdateListAPI['processor'] = (response) => response.value
