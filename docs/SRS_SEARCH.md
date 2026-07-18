# SRS: Search

**Project:** PowerNote
**Version:** 0.10.4
**Date:** 2026-03-25

## Purpose

Allow users to search for text content within the current page or across the entire notebook, with result highlighting and navigation.

## Requirements

| ID | Description | Priority | Test Ref |
|----|-------------|----------|----------|
| REQ-SEARCH-001 | Pressing Ctrl+F shall open a page-level search panel that filters text nodes on the current page | Must | T30 |
| REQ-SEARCH-002 | Pressing Ctrl+Shift+F shall open a notebook-wide search panel that searches across all sections and pages | Must | T31 |
| REQ-SEARCH-003 | Search results shall highlight matching text content in the result list | Must | T30 |
| REQ-SEARCH-004 | Clicking a notebook search result shall navigate to the page containing the match | Must | T31 |
| REQ-SEARCH-005 | Pressing Escape while the search panel is focused shall close it | Must | T30 |
| REQ-SEARCH-006 | The search panel shall provide a toggle to enter replace mode, revealing a replace input field | Must | T76 |
| REQ-SEARCH-007 | In replace mode, "Replace All" shall update every matching occurrence across the current search scope (current page or notebook-wide) | Must | T76 |
| REQ-SEARCH-008 | Replace operations shall update the underlying text node content in the canvas store (not just the visible rendering) | Must | T76 |
| REQ-SEARCH-009 | The search panel shall display the total number of matches and a snippet for each result | Should | T76 |
