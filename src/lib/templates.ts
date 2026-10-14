import type { EmailTemplate, MailerContact } from "../types/mailer";

export const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    id: "template-1",
    name: "Template 1: Academic Collaboration & Synergies",
    category: "Academic & Scientific Collaboration",
    subject: "Inquiry regarding your NIH research: {ProjectTitle}",
    body: `Dear Dr. {Name},

I hope this email finds you well.

I came across your NIH-funded research project titled "{ProjectTitle}" at {Institution}. Your lab's recent contributions and findings in this domain are truly remarkable.

Our group is currently exploring advanced developments in a closely related scientific area, and we are keen to explore potential academic synergies, cross-institution discussions, or collaborative avenues with your team.

Would you be open to a brief 10-15 minute introductory conversation sometime next week?

Thank you for your time, and I look forward to hearing from you.

Best regards,

Research Collaboration Advisory
{Institution} Network`,
  },
  {
    id: "template-2",
    name: "Template 2: Editorial & Peer Publication Invitation",
    category: "Editorial & Scientific Journal",
    subject: "Invitation to Contribute: Following your recent work on {ProjectTitle}",
    body: `Dear Dr. {Name},

On behalf of our editorial initiative, we have been closely following your ongoing NIH research program, "{ProjectTitle}", at {Institution}.

Given your distinguished track record and expertise, we would be delighted to invite you or a member of your research team to submit a review article, original research paper, or perspective piece for our upcoming thematic collection.

Your insights would provide immense value to the broader biomedical and scientific research community. We offer streamlined peer review and dedicated editorial support.

If you are interested, please reply to this message and we will gladly share the full call for papers, author guidelines, and submission details.

With warm regards,

Editorial & Outreach Board`,
  },
  {
    id: "template-3",
    name: "Template 3: Laboratory Technology, Services & Support",
    category: "Technical Services & Lab Support",
    subject: "Specialized research support for your project at {Institution}",
    body: `Dear Dr. {Name},

Congratulations on your NIH grant support for "{ProjectTitle}". We have been following the groundbreaking progress originating from your laboratory at {Institution}.

We specialize in providing high-precision data analysis, bioinformatics workflows, and customized technical consulting designed specifically to help NIH-funded laboratories expedite milestones, enhance data rigor, and prepare for high-impact publications.

We would be pleased to share a brief technical brief or case study tailored to the specific experimental requirements of your project.

Could we connect briefly this Thursday or Friday?

Sincerely,

Scientific Consulting & Services Group`,
  },
];

export const DEFAULT_SUBJECT_LINES: string[] = [
  "Inquiry regarding your NIH research: {ProjectTitle}",
  "Invitation to Contribute: Following your recent work on {ProjectTitle}",
  "Specialized research support for your project at {Institution}",
  "Collaborative research initiative regarding {ProjectTitle}",
  "Academic discussion & synergies with your laboratory at {Institution}",
];

export function formatBodyForHtml(text: string): string {
  if (!text) return "";

  // Convert Markdown Bold (**text** or __text__) to <strong>text</strong> and italic (*text*) to <em>text</em>
  const formatted = text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.*?)__/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>");

  // If text already has HTML block tags, wrap in Times New Roman styling container
  if (/<(p|div|table|ul|ol|h[1-6])[^>]*>/i.test(formatted)) {
    return `<div style="font-family: 'Times New Roman', Times, serif; font-size: 15px; line-height: 1.6; color: #1e293b;">${formatted}</div>`;
  }

  // Split into paragraphs by double newlines (two or more line breaks)
  const paragraphs = formatted.split(/\r?\n\s*\r?\n/);

  const innerHtml = paragraphs
    .map((para) => {
      const trimmed = para.trim();
      if (!trimmed) return "";
      // Single newlines inside a paragraph become <br> with natural spacing
      const withBreaks = trimmed.replace(/\r?\n/g, "<br>");
      return `<p style="margin: 0 0 14px 0; line-height: 1.6; font-size: 15px; font-family: 'Times New Roman', Times, serif;">${withBreaks}</p>`;
    })
    .filter(Boolean)
    .join("");

  return `<div style="font-family: 'Times New Roman', Times, serif; font-size: 15px; line-height: 1.6; color: #1e293b;">${innerHtml}</div>`;
}

export function renderTemplate(
  template: { subject: string; body: string },
  contact: Partial<MailerContact>,
): { subject: string; body: string } {
  const name = contact.name?.trim() || "Researcher";
  const title =
    contact.title?.trim() || "NIH Biomedical Research Project";
  const organization = contact.organization?.trim() || "your institution";
  const email = contact.email?.trim() || "";

  const replaceVars = (text: string): string => {
    if (!text) return "";
    return text
      // Name variations
      .replace(/\{Name\}/gi, name)
      .replace(/\{Author\}/gi, name)
      .replace(/\{AuthorName\}/gi, name)
      .replace(/\{Recipient\}/gi, name)
      .replace(/\{Contact\}/gi, name)
      // Project / Paper Title variations (including common typo 'Tile')
      .replace(/\{ProjectTitle\}/gi, title)
      .replace(/\{Project Title\}/gi, title)
      .replace(/\{Project_Title\}/gi, title)
      .replace(/\{Title\}/gi, title)
      .replace(/\{Tile\}/gi, title)
      .replace(/\{PaperTitle\}/gi, title)
      .replace(/\{Publication\}/gi, title)
      .replace(/\{Recent Publication\}/gi, title)
      // Institution / Affiliation
      .replace(/\{Institution\}/gi, organization)
      .replace(/\{Organization\}/gi, organization)
      .replace(/\{University\}/gi, organization)
      // Email
      .replace(/\{Email\}/gi, email);
  };

  return {
    subject: replaceVars(template.subject || ""),
    body: replaceVars(template.body || ""),
  };
}
