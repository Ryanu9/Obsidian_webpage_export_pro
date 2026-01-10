import { WebpageData } from "src/shared/website-data";

export class YamlProperties {
    constructor() { }

    public parseAndDisplayYamlProperties(documentData: WebpageData, container: HTMLElement): void {
        const propertiesOptions = (window as any).ObsidianSite.metadata.featureOptions.properties;

        if (!propertiesOptions?.showYamlProperties) return;

        const frontmatter = this.extractFrontmatter(container);
        if (!frontmatter || Object.keys(frontmatter).length === 0) return;

        // Custom filter based on hideProperties
        const filteredFrontmatter: Record<string, any> = {};
        const hiddenProps = propertiesOptions.hideProperties || [];
        for (const key in frontmatter) {
            if (!hiddenProps.includes(key)) {
                filteredFrontmatter[key] = frontmatter[key];
            }
        }

        if (Object.keys(filteredFrontmatter).length === 0) return;

        const yamlContainer = this.createYamlPropertiesContainer(filteredFrontmatter, propertiesOptions.yamlPropertiesDefaultExpanded);

        const dataBar = container.querySelector('.data-bar') as HTMLElement;
        if (dataBar) {
            dataBar.parentNode?.insertBefore(yamlContainer, dataBar);
        } else {
            const h1 = container.querySelector('h1');
            if (h1) h1.parentNode?.insertBefore(yamlContainer, h1.nextSibling);
        }
    }

    private extractFrontmatter(container: HTMLElement): Record<string, any> | null {
        try {
            const frontmatterEl = container.querySelector('.frontmatter, .yaml-frontmatter, pre[data-frontmatter]');
            if (!frontmatterEl) return null;

            // Clone the element to avoid modifying the original
            const clone = frontmatterEl.cloneNode(true) as HTMLElement;

            // Remove line number elements if they exist
            const lineNumberWrappers = clone.querySelectorAll('.line-numbers-wrapper, .line-number');
            lineNumberWrappers.forEach(el => el.remove());

            // Get text content without line numbers
            const textContent = clone.textContent;
            if (!textContent) return null;

            return this.parseYaml(textContent);
        } catch (error) {
            console.warn('解析YAML前置属性失败:', error);
            return null;
        }
    }

    private parseYaml(yamlText: string): Record<string, any> {
        const result: Record<string, any> = {};
        const lines = yamlText.split('\n');

        let currentKey: string | null = null;

        for (let line of lines) {
            line = line.trim();
            if (!line || line === '---') continue;

            if (line.startsWith('- ')) {
                if (currentKey) {
                    if (!Array.isArray(result[currentKey])) {
                        result[currentKey] = [];
                    }
                    result[currentKey].push(line.substring(2).trim().replace(/^['"](.*)['"]$/, '$1'));
                }
                continue;
            }

            const colonIndex = line.indexOf(':');
            if (colonIndex !== -1) {
                const key = line.substring(0, colonIndex).trim();
                let value: any = line.substring(colonIndex + 1).trim();

                if (value === '') {
                    currentKey = key;
                    result[key] = [];
                } else {
                    currentKey = key;
                    // Basic type conversion
                    if (value.startsWith('[') && value.endsWith(']')) {
                        value = value.substring(1, value.length - 1).split(',').map((v: string) => v.trim().replace(/^['"](.*)['"]$/, '$1'));
                    } else {
                        value = value.replace(/^['"](.*)['"]$/, '$1');
                        if (value === 'true') value = true;
                        else if (value === 'false') value = false;
                        else if (!isNaN(Number(value)) && value !== '') value = Number(value);
                    }
                    result[key] = value;
                }
            }
        }
        return result;
    }

    private createYamlPropertiesContainer(frontmatter: Record<string, any>, defaultExpanded: boolean): HTMLElement {
        const container = document.createElement('div');
        container.className = 'yaml-properties-container';

        const header = document.createElement('div');
        header.className = 'yaml-properties-header';

        const title = document.createElement('div');
        title.className = 'yaml-properties-title';
        title.textContent = '文档属性';

        const expandIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="m7 15 5 5 5-5"></path><path d="m7 9 5-5 5 5"></path></svg>`;
        const collapseIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="m7 20 5-5 5 5"></path><path d="m7 4 5 5 5-5"></path></svg>`;

        const toggleButton = document.createElement('button');
        toggleButton.className = 'yaml-properties-toggle';
        toggleButton.innerHTML = defaultExpanded ? collapseIcon : expandIcon;

        header.appendChild(title);
        header.appendChild(toggleButton);

        const content = document.createElement('div');
        content.className = 'yaml-properties-content';
        content.style.display = defaultExpanded ? 'block' : 'none';

        const table = this.createPropertiesTable(frontmatter);
        content.appendChild(table);

        container.appendChild(header);
        container.appendChild(content);

        header.style.cursor = 'pointer';
        header.addEventListener('click', () => {
            const isVisible = content.style.display === 'block';
            content.style.display = isVisible ? 'none' : 'block';
            toggleButton.innerHTML = isVisible ? expandIcon : collapseIcon;
        });

        this.injectStyles();

        return container;
    }

    private createPropertiesTable(frontmatter: Record<string, any>): HTMLElement {
        const table = document.createElement('table');
        table.className = 'yaml-properties-table';

        const isUrl = (val: string) => /^(https?:\/\/[^\s]+)$/.test(val);

        for (const key in frontmatter) {
            const tr = document.createElement('tr');

            const tdKey = document.createElement('td');
            tdKey.className = 'yaml-property-key';
            tdKey.textContent = key;

            const tdValue = document.createElement('td');
            tdValue.className = 'yaml-property-value';

            const val = frontmatter[key];
            const lowerKey = key.toLowerCase();

            if (lowerKey === 'tags' || lowerKey === 'tag') {
                const tags = Array.isArray(val) ? val : String(val).split(/[\s,]+/).filter(t => t.trim().length > 0);
                tags.forEach((tag, index) => {
                    const tagClean = tag.startsWith('#') ? tag : '#' + tag;
                    const tagEl = document.createElement('a');
                    tagEl.className = 'tag';
                    tagEl.textContent = tagClean;
                    const tagQuery = tagClean.startsWith('#') ? tagClean.substring(1) : tagClean;
                    tagEl.href = `?query=tags:${encodeURIComponent(tagQuery)}`;
                    tdValue.appendChild(tagEl);
                    if (index < tags.length - 1) {
                        tdValue.appendChild(document.createTextNode(' '));
                    }
                });
            } else if (typeof val === 'boolean') {
                const boolEl = document.createElement('span');
                boolEl.className = 'property-boolean ' + (val ? 'is-true' : 'is-false');
                boolEl.textContent = val ? 'true' : 'false';
                tdValue.appendChild(boolEl);
            } else if (Array.isArray(val)) {
                val.forEach((item, index) => {
                    const itemEl = document.createElement('span');
                    itemEl.className = 'property-list-item';
                    itemEl.textContent = String(item);
                    itemEl.style.cursor = 'pointer';
                    itemEl.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        (window as any).ObsidianSite.search?.searchParseFilters('"' + String(item) + '"');
                    });
                    tdValue.appendChild(itemEl);
                    if (index < val.length - 1) {
                        tdValue.appendChild(document.createTextNode(' '));
                    }
                });
            } else if (typeof val === 'string' && isUrl(val)) {
                const link = document.createElement('a');
                link.className = 'external-link';
                link.href = val;
                link.target = '_blank';
                link.rel = 'noopener';
                link.textContent = val;
                tdValue.appendChild(link);
            } else {
                tdValue.textContent = String(val);
            }

            tr.appendChild(tdKey);
            tr.appendChild(tdValue);
            table.appendChild(tr);
        }

        return table;
    }

    private injectStyles() {
        if (document.getElementById('yaml-properties-styles')) return;

        const style = document.createElement('style');
        style.id = 'yaml-properties-styles';
        style.textContent = `
            .yaml-properties-container {
                border: 1px solid var(--background-modifier-border);
                border-radius: 4px;
                margin: 1em 0;
                padding: 0;
                overflow: hidden;
                width: 100%;
                box-sizing: border-box;
            }
            .yaml-properties-header {
                background-color: transparent;
                padding: 8px 12px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid var(--background-modifier-border);
            }
            .yaml-properties-title {
                font-weight: bold;
                font-size: 0.9em;
                color: var(--text-muted);
            }
            .yaml-properties-toggle {
                background: none;
                border: none;
                color: var(--text-muted);
                cursor: pointer;
                padding: 0 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: color 0.2s ease;
            }
            .yaml-properties-toggle:hover {
                color: var(--text-normal);
            }
            .yaml-properties-toggle svg {
                width: 18px;
                height: 18px;
            }
            .yaml-properties-content {
                padding: 8px 12px;
                width: 100%;
                box-sizing: border-box;
            }
            .yaml-properties-table {
                width: 100% !important;
                border-collapse: collapse;
                font-size: 0.9em;
                table-layout: fixed;
                margin: 0;
                display: table;
            }
            .yaml-properties-table tr {
                width: 100%;
                display: table-row;
            }
            .yaml-property-key {
                color: var(--text-muted);
                width: 30% !important;
                padding: 4px 8px 4px 0;
                vertical-align: top;
                box-sizing: border-box;
            }
            .yaml-property-value {
                padding: 4px 0;
                word-break: break-all;
                width: 70% !important;
                box-sizing: border-box;
                flex-wrap: wrap;
                gap: 4px;
                align-items: center;
                overflow-wrap: break-word;
            }
            .yaml-properties-table td {
                box-sizing: border-box;
            }
            .yaml-property-value .tag,
            .yaml-property-value .property-list-item {
                background-color: var(--tag-background);
                color: var(--tag-color);
                border: var(--tag-border);
                border-radius: var(--tag-radius);
                padding: var(--tag-padding-y) var(--tag-padding-x);
                font-size: var(--tag-size);
                text-decoration: none;
                display: inline-block;
            }
            .yaml-property-value .tag:hover,
            .yaml-property-value .property-list-item:hover {
                background-color: var(--tag-background-hover);
                color: var(--tag-color-hover);
            }
            .yaml-property-value .external-link {
                color: var(--link-color);
                text-decoration: underline;
            }
            .yaml-property-value .external-link:hover {
                color: var(--link-color-hover);
            }
            .yaml-property-value .property-boolean.is-true {
                color: #22c55e;
                font-weight: bold;
            }
            .yaml-property-value .property-boolean.is-false {
                color: #ef4444;
                font-weight: bold;
            }
        `;
        document.head.appendChild(style);
    }
}
