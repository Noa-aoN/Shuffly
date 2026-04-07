# Be sure to restart your server when you modify this file.

# Define an application-wide content security policy.
# See the Securing Rails Applications Guide for more information:
# https://guides.rubyonrails.org/security.html#content-security-policy-header

Rails.application.configure do
  config.content_security_policy do |policy|
    policy.default_src :self, :https
    policy.font_src    :self, :https, :data
    policy.img_src     :self, :https, :data, :blob,
                       "https://www.google-analytics.com",
                       "https://www.googletagmanager.com",
                       "https://pagead2.googlesyndication.com",
                       "https://googleads.g.doubleclick.net",
                       "https://tpc.googlesyndication.com"
    policy.object_src  :none
    policy.base_uri    :self
    policy.frame_ancestors :self
    policy.frame_src   :self, "https://googleads.g.doubleclick.net", "https://tpc.googlesyndication.com"
    policy.style_src   :self, :https, :unsafe_inline
    policy.connect_src :self, :https,
                       "https://www.google-analytics.com",
                       "https://region1.google-analytics.com",
                       "https://www.googletagmanager.com",
                       "https://pagead2.googlesyndication.com"

    if Rails.env.development?
      policy.script_src :self, :https,
                        "https://www.googletagmanager.com",
                        "https://pagead2.googlesyndication.com",
                        :unsafe_inline, :unsafe_eval
    else
      policy.script_src :self, :https,
                        "https://www.googletagmanager.com",
                        "https://pagead2.googlesyndication.com"
    end

    # Specify URI for violation reports
    # policy.report_uri "/csp-violation-report-endpoint"
  end

  # Generate session nonces for permitted importmap, inline scripts, and inline styles.
  config.content_security_policy_nonce_generator = ->(request) { SecureRandom.base64(16) }
  config.content_security_policy_nonce_directives = %w[script-src style-src]

  config.content_security_policy_report_only = !Rails.env.production?
end
