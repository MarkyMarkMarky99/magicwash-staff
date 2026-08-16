# Problem Discovery

**Status:** Phase 1 Confirmed
**Related Module:** customers / query-builder
**Created by:** CODEX
**Date:** 2026-06-20

## Problem Statement

ปัจจุบัน logic การสร้าง query ใน `customer.service.ts` กระจายอยู่ในหลาย method ทำให้เพิ่ม filter/sort/pagination ใหม่ได้ยาก และมีโค้ดซ้ำที่เสี่ยงทำงานไม่ตรงกันระหว่าง flow

## Current Behavior

- `customer.service.ts` สร้าง query object แบบ inline ก่อนเรียก repository
- filter, sort, และ pagination ไม่มี abstraction กลาง
- tests ครอบคลุม service behavior บางส่วน แต่ไม่มี unit test เฉพาะ query-building logic

## Goal / Success Criteria

- มี `QueryBuilder` กลางสำหรับสร้าง `RepositoryReadQuery`
- service ใช้ query-building path เดียวกัน
- เพิ่ม filter/sort/pagination ใหม่ได้โดยไม่ duplicate logic
- unit tests ครอบคลุม edge cases ของ query builder
- `npm run typecheck` และ tests ผ่าน

## Scope

**In Scope**

- สร้าง `QueryBuilder`
- refactor query-building logic ใน `customer.service.ts`
- เพิ่ม unit tests สำหรับ `QueryBuilder`
- เพิ่ม/ปรับ service tests เท่าที่จำเป็น

**Out of Scope**

- เปลี่ยน repository layer
- เปลี่ยน database schema
- เปลี่ยน API response schema
- เพิ่ม filter ใหม่ที่ไม่ได้อยู่ใน current behavior

## Requirements / Constraints

**Functional**

- รองรับ method chaining
- สร้าง `RepositoryReadQuery` ได้ถูกต้อง
- รองรับ filter แบบ AND ตาม current behavior
- `orderBy()` หลายครั้งใช้ค่าล่าสุด
- `reset()` ล้าง internal state ได้

**Non-Functional**

- ไม่มี side effect ต่อ query object ที่ build ไปแล้ว
- implementation ต้องอ่านง่ายและ test แยกได้
