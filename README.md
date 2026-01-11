# Webpage HTML Export Pro

[English](README.md) | [中文](README-zh.md)

This plugin is a fork of [obsidian-webpage-export](https://github.com/KosmosisDire/obsidian-webpage-export) by KosmosisDire, with many new features and optimizations added to make it more suitable for use as a blog.

## Usage
1. Install the plugin.
2. Fill in your basic configurations and enable your preferred features in the plugin settings.
3. Press `ctrl+p` and select `set html export settings`.
4. Select the notes you want to export and click the Export button.

## New Features
look this:https://myblog-livid-iota.vercel.app/00-home/blog/webpage-html-export-pro.html

**This plugin supports i18n, so don't worry about language issues.**

- **Code Block Enhancements**: Supports one-click copy, word wrap, default collapse/expand, and clear language identifiers.
- **Line Highlighting**: Supports background highlighting of specific lines using the `>>>> ` syntax to improve code readability.
- **Interactive Image Viewer**: Click images to enter zoom mode, and use the mouse wheel for real-time zooming.
- **Long Image Auto-Collapse**: Automatically collapses large images to prevent pages from becoming too long and maintain a beautiful layout.
- **Frontmatter Display**: Shows YAML properties directly below the article title, with customizable default display states.
- **Smart Outline View**: Automatically highlights the corresponding title based on reading progress and allows setting the default collapse level for headings.
- **Folder Note Count**: Displays the total count of notes in each folder within the sidebar file tree in real-time.
- **Attachment Download Support**: Allows downloading attachment files linked in the notes directly from the exported webpage.
- **Standard Footnote Rendering**: Perfectly supports and renders the standard Obsidian footnote syntax.
- **Giscus Comments Integration**: Built-in comment system; just paste the script code from Giscus for automatic parsing and loading.
- **Private Page Encryption**: Supports password-protecting specific notes via frontmatter properties (`locked: true`, `password: "..."`) for precise content permission control.
- **Footer Customization**: Customizable copyright information and functional links at the bottom of the page.
- **Global Navigation Bar**: Supports a sticky navigation menu for quick jumps to friend links, changelogs, bios, etc. (simply use the relative path of the note).
- **Modal Search**: Use `Ctrl+K` to quickly trigger search and use `Tab` to preview context snippets of the results.
- **Document Timestamp Display**: Shows the creation date and last update date prominently in the article.
- **Vercel Insights Support**: Integrated Vercel deployment analysis to track traffic and performance data if you deploy via Vercel.
- **Configuration Persistence**: Supports saving, updating, and switching between multiple export configuration presets.


