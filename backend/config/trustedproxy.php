<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Trusted proxies
    |--------------------------------------------------------------------------
    |
    | Only a request that arrives FROM one of these addresses may tell the app the visitor's real IP,
    | host and scheme (X-Forwarded-For, -Host, -Proto ...). From anyone else those headers are ignored,
    | so a visitor cannot fake the IP that is written to the audit log.
    |
    | Set TRUSTED_PROXIES in .env to a comma-separated list of the IPs (or CIDR ranges) of YOUR reverse
    | proxy / load balancer, for example:
    |
    |     TRUSTED_PROXIES=127.0.0.1                     (nginx or Apache on the same server)
    |     TRUSTED_PROXIES=10.0.0.5,10.0.0.6             (two load balancers)
    |     TRUSTED_PROXIES=192.168.0.0/24                (a whole private range)
    |
    | Leave it empty when the app is reached directly (local development, `php artisan serve`): then no
    | forwarded header is trusted and the visitor's own address is used.
    | Do NOT use "*" in production: it trusts every sender, which is what allows IP spoofing.
    |
    */

    'proxies' => env('TRUSTED_PROXIES') ?: null,

];
