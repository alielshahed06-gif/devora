import React from 'react';
export default function Link({ href, children, ...rest }: any) { return <a href={'?p=' + encodeURIComponent(href)} data-href={href} {...rest}>{children}</a>; }
